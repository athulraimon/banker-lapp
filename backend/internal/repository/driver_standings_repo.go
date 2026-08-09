package repository

import (
	"context"
	"time"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DriverStandingsRepository struct {
	db *pgxpool.Pool
}

func NewDriverStandingsRepository(db *pgxpool.Pool) *DriverStandingsRepository {
	return &DriverStandingsRepository{db: db}
}

// Replace overwrites the stored standings for a season in one transaction,
// stamping every row with the same refresh time.
func (r *DriverStandingsRepository) Replace(ctx context.Context, season int, standings []domain.DriverStanding) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM driver_standings WHERE season = $1`, season); err != nil {
		return err
	}

	for _, s := range standings {
		if _, err := tx.Exec(ctx, `
			INSERT INTO driver_standings
				(season, driver_id, position, points, wins, broadcast_name, team_name, team_color, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		`, season, s.DriverID, s.Position, s.Points, s.Wins, s.BroadcastName, s.TeamName, s.TeamColor); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Get returns the stored standings for a season ordered by position, along with
// the time they were last refreshed (zero time if none are stored).
func (r *DriverStandingsRepository) Get(ctx context.Context, season int) ([]domain.DriverStanding, time.Time, error) {
	rows, err := r.db.Query(ctx, `
		SELECT position, points, wins, driver_id, broadcast_name, team_name, team_color, updated_at
		FROM driver_standings
		WHERE season = $1
		ORDER BY position ASC
	`, season)
	if err != nil {
		return nil, time.Time{}, err
	}
	defer rows.Close()

	standings := make([]domain.DriverStanding, 0)
	var updatedAt time.Time
	for rows.Next() {
		var s domain.DriverStanding
		var u time.Time
		if err := rows.Scan(&s.Position, &s.Points, &s.Wins, &s.DriverID, &s.BroadcastName, &s.TeamName, &s.TeamColor, &u); err != nil {
			return nil, time.Time{}, err
		}
		if u.After(updatedAt) {
			updatedAt = u
		}
		standings = append(standings, s)
	}
	return standings, updatedAt, rows.Err()
}
