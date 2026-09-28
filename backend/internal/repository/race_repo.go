package repository

import (
	"context"
	"time"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// raceColumns is shared by every SELECT so the column list and the Scan order
// can't drift apart when a session is added.
const raceColumns = `id, api_race_id, grand_prix, circuit_name, country,
	fp1_time, fp2_time, fp3_time, sprint_qualifying_time, sprint_time,
	qualifying_time, race_time, season, status, pole_driver_id`

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
		&race.QualifyingTime, &race.RaceTime, &race.Season, &race.Status, &race.PoleDriverID,
	)
}

func (r *RaceRepository) UpsertRace(ctx context.Context, race *domain.Race) error {
	// If official results already exist for this race, keep it "completed" so a
	// schedule re-sync never reverts an admin-entered result to a time-based status.
	//
	// The name/circuit/country are refreshed alongside the times, because
	// api_race_id encodes the round number and the FIA renumbers rounds when a
	// race is added, dropped or reordered mid-season. Updating only the times
	// left round N carrying the previous calendar's name with the new
	// calendar's dates — every race after the insertion point displayed the
	// following race's schedule, and the final round appeared twice.
	query := `
		INSERT INTO races (api_race_id, grand_prix, circuit_name, country,
			fp1_time, fp2_time, fp3_time, sprint_qualifying_time, sprint_time,
			qualifying_time, race_time, season, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (api_race_id) DO UPDATE
		SET grand_prix = EXCLUDED.grand_prix,
			circuit_name = EXCLUDED.circuit_name,
			country = EXCLUDED.country,
			fp1_time = EXCLUDED.fp1_time,
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

// DeleteStaleRaces removes rows for the season whose api_race_id is no longer
// in the upstream calendar, returning how many were deleted.
//
// Without this, a calendar that shrinks (a race dropped, or rounds renumbered
// downwards) strands the trailing rounds forever: they keep the old name and
// date and show up as phantom duplicates in the app.
//
// Races that already carry a prediction, an official result or a score are left
// alone. Those tables have no ON DELETE CASCADE, so deleting one would fail the
// whole sync on a foreign key violation — and a race someone has staked picks on
// should never disappear silently anyway. Such a row is reported by the caller
// instead so it can be reconciled by hand.
func (r *RaceRepository) DeleteStaleRaces(ctx context.Context, season int, keepAPIRaceIDs []string) (int, error) {
	query := `
		DELETE FROM races
		WHERE season = $1
		  AND NOT (api_race_id = ANY($2))
		  AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.race_id = races.id)
		  AND NOT EXISTS (SELECT 1 FROM race_results rr WHERE rr.race_id = races.id)
		  AND NOT EXISTS (SELECT 1 FROM race_scores rs WHERE rs.race_id = races.id)
	`
	tag, err := r.db.Exec(ctx, query, season, keepAPIRaceIDs)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// ListStaleRaces returns races for the season that are absent from the upstream
// calendar but could not be removed because data hangs off them.
func (r *RaceRepository) ListStaleRaces(ctx context.Context, season int, keepAPIRaceIDs []string) ([]domain.Race, error) {
	query := `SELECT ` + raceColumns + ` FROM races
		WHERE season = $1 AND NOT (api_race_id = ANY($2))
		ORDER BY race_time ASC`
	rows, err := r.db.Query(ctx, query, season, keepAPIRaceIDs)
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

// SetPoleDriverID records the auto-detected pole sitter ahead of the full race
// result. Safe to call repeatedly; the poller only calls it once per race
// since ListRacesNeedingPolePoll excludes rows that already have one.
func (r *RaceRepository) SetPoleDriverID(ctx context.Context, id, driverID string) error {
	_, err := r.db.Exec(ctx, `UPDATE races SET pole_driver_id = $2 WHERE id = $1`, id, driverID)
	return err
}

// ListRacesNeedingPolePoll returns races whose qualifying session has started
// but whose pole sitter is not yet known, bounded by raceDuration past race
// time so a race Jolpica never publishes doesn't get polled forever.
func (r *RaceRepository) ListRacesNeedingPolePoll(ctx context.Context, now time.Time, raceDuration time.Duration) ([]domain.Race, error) {
	query := `SELECT ` + raceColumns + ` FROM races
		WHERE pole_driver_id IS NULL
		  AND status != 'completed'
		  AND qualifying_time <= $1
		  AND race_time + make_interval(secs => $2) > $1`
	rows, err := r.db.Query(ctx, query, now, raceDuration.Seconds())
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

// ListRacesNeedingResultPoll returns races whose race session has started but
// which have no official result yet, bounded the same way as
// ListRacesNeedingPolePoll.
func (r *RaceRepository) ListRacesNeedingResultPoll(ctx context.Context, now time.Time, raceDuration time.Duration) ([]domain.Race, error) {
	query := `SELECT ` + raceColumns + ` FROM races
		WHERE status != 'completed'
		  AND race_time <= $1
		  AND race_time + make_interval(secs => $2) > $1`
	rows, err := r.db.Query(ctx, query, now, raceDuration.Seconds())
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
