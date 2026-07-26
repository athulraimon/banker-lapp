package repository

import (
	"context"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PredictionRepository struct {
	db *pgxpool.Pool
}

func NewPredictionRepository(db *pgxpool.Pool) *PredictionRepository {
	return &PredictionRepository{db: db}
}

func (r *PredictionRepository) UpsertPrediction(ctx context.Context, p *domain.Prediction) error {
	query := `
		INSERT INTO predictions (user_id, race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, locked, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id, race_id) DO UPDATE 
		SET pole_driver_id = EXCLUDED.pole_driver_id,
			p1_driver_id = EXCLUDED.p1_driver_id,
			p2_driver_id = EXCLUDED.p2_driver_id,
			p3_driver_id = EXCLUDED.p3_driver_id,
			locked = EXCLUDED.locked,
			updated_at = NOW()
		WHERE predictions.locked = FALSE
	`
	_, err := r.db.Exec(ctx, query, p.UserID, p.RaceID, p.PoleDriverID, p.P1DriverID, p.P2DriverID, p.P3DriverID, p.Locked)
	return err
}

// AdminUpsertPrediction writes a prediction ignoring the lock flag. Only the
// admin flow calls this so it can correct entries after FP1.
func (r *PredictionRepository) AdminUpsertPrediction(ctx context.Context, p *domain.Prediction) error {
	query := `
		INSERT INTO predictions (user_id, race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, locked, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id, race_id) DO UPDATE
		SET pole_driver_id = EXCLUDED.pole_driver_id,
			p1_driver_id = EXCLUDED.p1_driver_id,
			p2_driver_id = EXCLUDED.p2_driver_id,
			p3_driver_id = EXCLUDED.p3_driver_id,
			updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, p.UserID, p.RaceID, p.PoleDriverID, p.P1DriverID, p.P2DriverID, p.P3DriverID, p.Locked)
	return err
}

func (r *PredictionRepository) GetUserPredictionForRace(ctx context.Context, userID, raceID string) (*domain.Prediction, error) {
	query := `SELECT id, user_id, race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, locked, created_at, updated_at
	          FROM predictions WHERE user_id = $1 AND race_id = $2`
	var p domain.Prediction
	err := r.db.QueryRow(ctx, query, userID, raceID).Scan(&p.ID, &p.UserID, &p.RaceID, &p.PoleDriverID, &p.P1DriverID, &p.P2DriverID, &p.P3DriverID, &p.Locked, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *PredictionRepository) GetAllPredictionsForRace(ctx context.Context, raceID string) ([]domain.Prediction, error) {
	query := `SELECT id, user_id, race_id, pole_driver_id, p1_driver_id, p2_driver_id, p3_driver_id, locked, created_at, updated_at
	          FROM predictions WHERE race_id = $1`
	rows, err := r.db.Query(ctx, query, raceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	predictions := make([]domain.Prediction, 0)
	for rows.Next() {
		var p domain.Prediction
		if err := rows.Scan(&p.ID, &p.UserID, &p.RaceID, &p.PoleDriverID, &p.P1DriverID, &p.P2DriverID, &p.P3DriverID, &p.Locked, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		predictions = append(predictions, p)
	}
	return predictions, nil
}
