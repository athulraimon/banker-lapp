package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrRefreshTokenNotFound is returned when a user has no live refresh token,
// either because they logged out or because it expired.
var ErrRefreshTokenNotFound = errors.New("refresh token not found")

// RefreshTokenRepository stores one live refresh token per user. This replaces
// the previous Redis-backed store; expiry is enforced by the expires_at column
// rather than a key TTL.
type RefreshTokenRepository struct {
	db *pgxpool.Pool
}

func NewRefreshTokenRepository(db *pgxpool.Pool) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

// Store replaces any existing token for the user, mirroring the old
// single-key-per-user Redis semantics: logging in elsewhere revokes the old one.
func (r *RefreshTokenRepository) Store(ctx context.Context, userID, token string, ttl time.Duration) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE
		SET token = EXCLUDED.token,
		    expires_at = EXCLUDED.expires_at,
		    created_at = NOW()`,
		userID, token, time.Now().Add(ttl))
	return err
}

// Get returns the stored token for a user, treating an expired row as absent.
func (r *RefreshTokenRepository) Get(ctx context.Context, userID string) (string, error) {
	var token string
	err := r.db.QueryRow(ctx, `
		SELECT token FROM refresh_tokens
		WHERE user_id = $1 AND expires_at > NOW()`, userID).Scan(&token)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrRefreshTokenNotFound
	}
	return token, err
}

// Touch slides the expiry forward so users who keep using the app stay logged in.
func (r *RefreshTokenRepository) Touch(ctx context.Context, userID string, ttl time.Duration) error {
	_, err := r.db.Exec(ctx, `
		UPDATE refresh_tokens SET expires_at = $2
		WHERE user_id = $1`, userID, time.Now().Add(ttl))
	return err
}

// Delete revokes the user's refresh token (logout).
func (r *RefreshTokenRepository) Delete(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

// DeleteExpired sweeps rows Redis would have evicted on its own. Called
// periodically by the scheduler.
func (r *RefreshTokenRepository) DeleteExpired(ctx context.Context) (int64, error) {
	tag, err := r.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE expires_at <= NOW()`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
