package repository

import (
	"context"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// raceColumns is shared by every SELECT so the column list and the Scan order
// can't drift apart when a session is added.
const raceColumns = `id, api_race_id, grand_prix, circuit_name, country,
	fp1_time, fp2_time, fp3_time, sprint_qualifying_time, sprint_time,
	qualifying_time, race_time, season, status`

type RaceRepository struct {
	db *pgxpool.Pool
}

func NewRaceRepository(db *pgxpool.Pool) *RaceRepository {
	return &RaceRepository{db: db}
}

func scanRace(row pgx.Row, race *domain.Race) error {
	return row.Scan(
		&race.ID, &race.APIRaceID, &race.GrandPrix, &race.CircuitName, &race.Country,
		&race.FP1Time, &race.FP2Time, &race.FP3Time, &race.SprintQualifyingTime, &race.SprintTime,
		&race.QualifyingTime, &race.RaceTime, &race.Season, &race.Status,
	)
}

func (r *RaceRepository) UpsertRace(ctx context.Context, race *domain.Race) error {
	// If official results already exist for this race, keep it "completed" so a
	// schedule re-sync never reverts an admin-entered result to a time-based status.
	query := `
		INSERT INTO races (api_race_id, grand_prix, circuit_name, country,
			fp1_time, fp2_time, fp3_time, sprint_qualifying_time, sprint_time,
			qualifying_time, race_time, season, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (api_race_id) DO UPDATE
		SET fp1_time = EXCLUDED.fp1_time,
			fp2_time = EXCLUDED.fp2_time,
			fp3_time = EXCLUDED.fp3_time,
			sprint_qualifying_time = EXCLUDED.sprint_qualifying_time,
			sprint_time = EXCLUDED.sprint_time,
			qualifying_time = EXCLUDED.qualifying_time,
			race_time = EXCLUDED.race_time,
			status = CASE
				WHEN EXISTS (SELECT 1 FROM race_results rr WHERE rr.race_id = races.id) THEN 'completed'
				ELSE EXCLUDED.status
			END
	`
	_, err := r.db.Exec(ctx, query,
		race.APIRaceID, race.GrandPrix, race.CircuitName, race.Country,
		race.FP1Time, race.FP2Time, race.FP3Time, race.SprintQualifyingTime, race.SprintTime,
		race.QualifyingTime, race.RaceTime, race.Season, race.Status,
	)
	return err
}

func (r *RaceRepository) GetRacesBySeason(ctx context.Context, season int) ([]domain.Race, error) {
	query := `SELECT ` + raceColumns + ` FROM races WHERE season = $1 ORDER BY race_time ASC`
	rows, err := r.db.Query(ctx, query, season)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	races := make([]domain.Race, 0)
	for rows.Next() {
		var race domain.Race
		if err := scanRace(rows, &race); err != nil {
			return nil, err
		}
		races = append(races, race)
	}
	return races, rows.Err()
}

// UpdateStatus sets the workflow status of a race (e.g. "completed").
func (r *RaceRepository) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE races SET status = $2 WHERE id = $1`, id, status)
	return err
}

func (r *RaceRepository) GetRaceByID(ctx context.Context, id string) (*domain.Race, error) {
	query := `SELECT ` + raceColumns + ` FROM races WHERE id = $1`
	var race domain.Race
	if err := scanRace(r.db.QueryRow(ctx, query, id), &race); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &race, nil
}
