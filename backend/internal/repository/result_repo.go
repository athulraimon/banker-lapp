package repository

import (
	"context"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ResultRepository struct {
	db *pgxpool.Pool
}

func NewResultRepository(db *pgxpool.Pool) *ResultRepository {
	return &ResultRepository{db: db}
}

func (r *ResultRepository) UpsertRaceResult(ctx context.Context, result *domain.RaceResult) error {
	query := `
		INSERT INTO race_results (race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, fetched_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (race_id) DO UPDATE 
		SET pole_driver_id = EXCLUDED.pole_driver_id,
			p1_driver_id = EXCLUDED.p1_driver_id,
			p2_driver_id = EXCLUDED.p2_driver_id,
			p3_driver_id = EXCLUDED.p3_driver_id,
			fetched_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, result.RaceID, result.PoleDriverID, result.P1DriverID, result.P2DriverID, result.P3DriverID)
	return err
}

// DeleteRaceResult removes the official result for a race (no error if absent).
func (r *ResultRepository) DeleteRaceResult(ctx context.Context, raceID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM race_results WHERE race_id = $1`, raceID)
	return err
}

func (r *ResultRepository) GetRaceResult(ctx context.Context, raceID string) (*domain.RaceResult, error) {
	query := `SELECT id, race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, fetched_at FROM race_results WHERE race_id = $1`
	var res domain.RaceResult
	err := r.db.QueryRow(ctx, query, raceID).Scan(&res.ID, &res.RaceID, &res.PoleDriverID, &res.P1DriverID, &res.P2DriverID, &res.P3DriverID, &res.FetchedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &res, nil
}
