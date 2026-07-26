package service

import (
	"context"
	"errors"
	"log"
	"time"

	"banker_lapp_backend/internal/config"
	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/api/idtoken"
)

type AuthService struct {
	repo   *repository.UserRepository
	tokens *repository.RefreshTokenRepository
	config *config.Config
}

func NewAuthService(repo *repository.UserRepository, tokens *repository.RefreshTokenRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		repo:   repo,
		tokens: tokens,
		config: cfg,
	}
}

type TokenResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         *domain.User `json:"user"`
}

func (s *AuthService) VerifyGoogleTokenAndLogin(ctx context.Context, idTokenStr string) (*TokenResponse, error) {
	// Verify Google ID Token
	payload, err := idtoken.Validate(ctx, idTokenStr, s.config.GoogleClient)
	if err != nil {
		return nil, errors.New("invalid google token")
	}

	googleID := payload.Subject
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	if name == "" {
		name = email
	}
	photoURL := ""
	if photo, ok := payload.Claims["picture"].(string); ok {
		photoURL = photo
	}

	// Admin rights come from the ADMIN_EMAILS allowlist, re-evaluated on every login.
	isAdmin := s.config.IsAdminEmail(email)

	// Upsert User in DB
	user, err := s.repo.UpsertUser(ctx, googleID, email, name, photoURL, isAdmin)
	if err != nil {
		return nil, err
	}

	// Generate JWTs
	return s.generateTokens(ctx, user)
}

func (s *AuthService) DevLogin(ctx context.Context) (*TokenResponse, error) {
	log.Printf("[DevLogin] Starting dev login")
	user, err := s.repo.UpsertDevUser(ctx)
	if err != nil {
		log.Printf("[DevLogin] UpsertDevUser error: %v", err)
		return nil, err
	}
	log.Printf("[DevLogin] Created dev user: %+v", user)

	return s.generateTokens(ctx, user)
}

const (
	accessTokenTTL  = 60 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
)

// signAccessToken issues a short-lived access token for the user.
func (s *AuthService) signAccessToken(user *domain.User) (string, error) {
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  user.ID,
		"is_admin": user.IsAdmin,
		"exp":      time.Now().Add(accessTokenTTL).Unix(),
	})
	return accessToken.SignedString([]byte(s.config.JWTSecret))
}

func (s *AuthService) generateTokens(ctx context.Context, user *domain.User) (*TokenResponse, error) {
	log.Printf("[generateTokens] Generating tokens for user: %s", user.ID)

	accessTokenString, err := s.signAccessToken(user)
	if err != nil {
		log.Printf("[generateTokens] Access token signing error: %v", err)
		return nil, err
	}

	// Refresh Token (expires in 7 days)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(refreshTokenTTL).Unix(),
	})
	refreshTokenString, err := refreshToken.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		log.Printf("[generateTokens] Refresh token signing error: %v", err)
		return nil, err
	}

	// Persist the refresh token so it can be revoked on logout and validated on
	// refresh. Postgres replaces the old Redis key; expiry lives in expires_at.
	if err := s.tokens.Store(ctx, user.ID, refreshTokenString, refreshTokenTTL); err != nil {
		log.Printf("[generateTokens] failed to store refresh token for user %s: %v", user.ID, err)
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		User:         user,
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshTokenString string) (*TokenResponse, error) {
	// Parse refresh token
	token, err := jwt.Parse(refreshTokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.config.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	userID := claims["user_id"].(string)

	// The token must still be the one we issued and not yet expired.
	storedToken, err := s.tokens.Get(ctx, userID)
	if err != nil || storedToken != refreshTokenString {
		return nil, errors.New("refresh token revoked or expired")
	}

	// Fetch user to get current admin status
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	// Issue only a new access token and KEEP the same refresh token. Rotating it
	// here caused logouts: the app fires several requests at once, each of which
	// would refresh concurrently and invalidate the others' tokens. We just slide
	// the refresh token's expiry so active users stay logged in.
	accessTokenString, err := s.signAccessToken(user)
	if err != nil {
		return nil, err
	}
	if err := s.tokens.Touch(ctx, userID, refreshTokenTTL); err != nil {
		log.Printf("[RefreshToken] failed to slide refresh expiry: %v", err)
	}

	return &TokenResponse{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		User:         user,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, userID string) error {
	return s.tokens.Delete(ctx, userID)
}
