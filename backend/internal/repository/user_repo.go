package repository

import (
	"context"
	"log"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) UpsertUser(ctx context.Context, googleID, email, name, photoURL string, isAdmin bool) (*domain.User, error) {
	// is_admin is derived from the ADMIN_EMAILS allowlist on every login, so it
	// stays correct if the allowlist changes later.
	//
	// display_name is the exception: once a player has renamed themselves, their
	// choice wins and Google's profile name is ignored from then on. Overwriting it
	// here would undo the rename on their next sign-in.
	query := `
		INSERT INTO users (google_id, email, display_name, photo_url, is_admin)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (google_id) DO UPDATE
		SET display_name = CASE
				WHEN users.display_name_custom THEN users.display_name
				ELSE EXCLUDED.display_name
			END,
		    photo_url = EXCLUDED.photo_url,
		    email = EXCLUDED.email,
		    is_admin = EXCLUDED.is_admin
		RETURNING id, google_id, display_name, email, photo_url, is_admin, created_at
	`
	var user domain.User
	err := r.db.QueryRow(ctx, query, googleID, email, name, photoURL, isAdmin).Scan(
		&user.ID,
		&user.GoogleID,
		&user.DisplayName,
		&user.Email,
		&user.PhotoURL,
		&user.IsAdmin,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) UpsertDevUser(ctx context.Context) (*domain.User, error) {
	log.Printf("[UpsertDevUser] Starting dev user upsert")
	query := `
		INSERT INTO users (google_id, email, display_name, photo_url, is_admin)
		VALUES ('dev-local-user', 'dev@banker-lapp.local', 'Dev User', '', TRUE)
		ON CONFLICT (google_id) DO UPDATE
		SET display_name = EXCLUDED.display_name,
		    photo_url = EXCLUDED.photo_url,
		    is_admin = TRUE
		RETURNING id, google_id, display_name, email, photo_url, is_admin, created_at
	`
	var user domain.User
	err := r.db.QueryRow(ctx, query).Scan(
		&user.ID,
		&user.GoogleID,
		&user.DisplayName,
		&user.Email,
		&user.PhotoURL,
		&user.IsAdmin,
		&user.CreatedAt,
	)
	if err != nil {
		log.Printf("[UpsertDevUser] Query error: %v", err)
		return nil, err
	}
	log.Printf("[UpsertDevUser] Successfully created/updated dev user: %+v", user)
	return &user, nil
}

// ListUsers returns every registered user, newest first.
func (r *UserRepository) ListUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.Query(ctx, `SELECT id, google_id, display_name, email, photo_url, is_admin, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.GoogleID, &u.DisplayName, &u.Email, &u.PhotoURL, &u.IsAdmin, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `SELECT id, google_id, display_name, email, photo_url, is_admin, created_at FROM users WHERE id = $1`
	var user domain.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.GoogleID,
		&user.DisplayName,
		&user.Email,
		&user.PhotoURL,
		&user.IsAdmin,
		&user.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// UpdateDisplayName renames a player and marks the name as hand-chosen, so
// UpsertUser stops replacing it with their Google profile name on every login.
func (r *UserRepository) UpdateDisplayName(ctx context.Context, userID, displayName string) (*domain.User, error) {
	query := `
		UPDATE users
		SET display_name = $2, display_name_custom = TRUE
		WHERE id = $1
		RETURNING id, google_id, display_name, email, photo_url, is_admin, created_at
	`
	var user domain.User
	err := r.db.QueryRow(ctx, query, userID, displayName).Scan(
		&user.ID, &user.GoogleID, &user.DisplayName, &user.Email,
		&user.PhotoURL, &user.IsAdmin, &user.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// DeleteUser removes a player and everything belonging to them.
//
// predictions and race_scores reference users(id) with no ON DELETE CASCADE, so
// deleting the row on its own fails on a foreign key violation. refresh_tokens
// does cascade, but is cleared explicitly anyway so the whole teardown is visible
// in one list rather than half here and half in the schema.
//
// One transaction, because a half-deleted account would leave predictions and
// scores pointing at a user who no longer exists — and the standings query joins
// straight through those tables.
//
// This is irreversible and takes the player's history with it. Only the account's
// own owner can reach it, via DELETE /auth/me.
func (r *UserRepository) DeleteUser(ctx context.Context, userID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, stmt := range []string{
		`DELETE FROM race_scores WHERE user_id = $1`,
		`DELETE FROM predictions WHERE user_id = $1`,
		`DELETE FROM refresh_tokens WHERE user_id = $1`,
		`DELETE FROM users WHERE id = $1`,
	} {
		if _, err := tx.Exec(ctx, stmt, userID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
