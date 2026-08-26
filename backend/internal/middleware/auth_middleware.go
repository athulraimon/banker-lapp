package middleware

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"banker_lapp_backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

// claimsFrom parses the Bearer token on the request, if there is one. It returns
// nil claims and a nil error when no token was sent at all, which is what lets
// OptionalAuth tell "signed out" apart from "sent something broken".
func claimsFrom(c echo.Context, cfg *config.Config) (jwt.MapClaims, error) {
	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, nil
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("token is not valid")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

// AuthMiddleware rejects anything without a valid session.
func AuthMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, err := claimsFrom(c, cfg)
			if err != nil {
				// Deliberately does not log the token itself: these lines go to
				// the hosting platform's log store, and a leaked access token
				// there is a live session anyone reading logs can replay.
				log.Printf("[AuthMiddleware] Rejected %s %s: %v", c.Request().Method, c.Request().URL.Path, err)
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
			}
			if claims == nil {
				log.Printf("[AuthMiddleware] Rejected %s %s: no token", c.Request().Method, c.Request().URL.Path)
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing or invalid token"})
			}

			c.Set("user_id", claims["user_id"])
			c.Set("is_admin", claims["is_admin"])
			return next(c)
		}
	}
}

// OptionalAuth identifies the caller when it can and waves them through when it
// cannot. It backs the guest mode: the same endpoint serves public F1 data to a
// signed-out visitor and the player's own data to a signed-in one, so the app
// does not need a second set of URLs for guests.
//
// A malformed or expired token is still a hard 401 rather than a silent demotion
// to guest. Downgrading would hide an expired session behind a page that simply
// looks empty, and the app's refresh-on-401 would never fire.
func OptionalAuth(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, err := claimsFrom(c, cfg)
			if err != nil {
				log.Printf("[OptionalAuth] Rejected %s %s: %v", c.Request().Method, c.Request().URL.Path, err)
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
			}
			if claims != nil {
				c.Set("user_id", claims["user_id"])
				c.Set("is_admin", claims["is_admin"])
			}
			return next(c)
		}
	}
}

// IsSignedIn reports whether the request carried a valid session. Handlers behind
// OptionalAuth use it to decide how much to return.
func IsSignedIn(c echo.Context) bool {
	userID, ok := c.Get("user_id").(string)
	return ok && userID != ""
}

func AdminMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isAdmin, ok := c.Get("is_admin").(bool)
		if !ok || !isAdmin {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "admin access required"})
		}
		return next(c)
	}
}
