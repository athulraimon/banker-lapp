package repository

import (
	"context"
	"time"

	"banker_lapp_backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ScoreRepository struct {
	db *pgxpool.Pool
}

func NewScoreRepository(db *pgxpool.Pool) *ScoreRepository {
	return &ScoreRepository{db: db}
}

func (r *ScoreRepository) UpsertRaceScore(ctx context.Context, score *domain.RaceScore) error {
	query := `
		INSERT INTO race_scores (user_id, race_id, points, correct_winner, calculated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (user_id, race_id) DO UPDATE 
		SET points = EXCLUDED.points,
			correct_winner = EXCLUDED.correct_winner,
			calculated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, score.UserID, score.RaceID, score.Points, score.CorrectWinner)
	return err
}

// DeleteRaceScores removes all computed scores for a race.
func (r *ScoreRepository) DeleteRaceScores(ctx context.Context, raceID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM race_scores WHERE race_id = $1`, raceID)
	return err
}

func (r *ScoreRepository) GetGlobalStandings(ctx context.Context) ([]domain.Standing, error) {
	// Calculate global standings using a join on users and grouping by user,
	// sorting by points (desc) -> correct_winners (desc) -> poles (desc)
	query := `
		SELECT 
			u.id as user_id,
			u.display_name as user_name,
			COALESCE(SUM(s.points), 0) as total_points,
			COALESCE(SUM(CASE WHEN s.correct_winner THEN 1 ELSE 0 END), 0) as correct_winners,
			COALESCE(SUM(CASE WHEN p.pole_driver_id = r.pole_driver_id THEN 1 ELSE 0 END), 0) as pole_count
		FROM users u
		LEFT JOIN race_scores s ON u.id = s.user_id
		LEFT JOIN predictions p ON p.user_id = u.id AND p.race_id = s.race_id
		LEFT JOIN race_results r ON r.race_id = s.race_id
		GROUP BY u.id, u.display_name
		ORDER BY total_points DESC, correct_winners DESC, pole_count DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	standings := make([]domain.Standing, 0)
	rank := 1
	for rows.Next() {
		var s domain.Standing
		if err := rows.Scan(&s.UserID, &s.UserName, &s.TotalPoints, &s.CorrectWinners, &s.PoleCount); err != nil {
			return nil, err
		}
		s.Rank = rank
		standings = append(standings, s)
		rank++
	}
	return standings, nil
}

func (r *ScoreRepository) GetRaceScores(ctx context.Context, raceID string) ([]domain.RaceScore, error) {
	query := `
		SELECT s.id, s.user_id, u.display_name, s.race_id, s.points, s.correct_winner, s.calculated_at
		FROM race_scores s
		JOIN users u ON u.id = s.user_id
		WHERE s.race_id = $1
		ORDER BY s.points DESC, s.correct_winner DESC
	`
	rows, err := r.db.Query(ctx, query, raceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	scores := make([]domain.RaceScore, 0)
	for rows.Next() {
		var s domain.RaceScore
		if err := rows.Scan(&s.ID, &s.UserID, &s.UserName, &s.RaceID, &s.Points, &s.CorrectWinner, &s.CalculatedAt); err != nil {
			return nil, err
		}
		scores = append(scores, s)
	}
	return scores, nil
}

// GetPlayerCompletedRaces returns every race the player entered a prediction for
// that has since finished, newest first, with the official result attached where
// one has been entered.
//
// The result join is a LEFT JOIN on purpose. A race can be over while an admin
// has not yet entered the podium, and those rows still belong in the history —
// gating on race_results made them vanish, which reads as though the player never
// entered. The Resulted flag lets the caller label them instead.
//
// finishedBefore is the privacy boundary: predictions for a race that has not
// finished are still live, so the caller passes now-RaceDuration and this query
// can never return them. It is a parameter rather than an interval literal in the
// SQL so the cutoff keeps exactly one definition, domain.RaceDuration, shared
// with the dashboard's notion of a finished weekend.
//
// Round is not a column on races - the app derives it by ordering a season by
// race time - so it is computed the same way here, windowed over the whole season
// rather than only the races this player entered.
func (r *ScoreRepository) GetPlayerCompletedRaces(ctx context.Context, userID string, finishedBefore time.Time) ([]domain.PlayerRaceEntry, error) {
	query := `
		WITH rounds AS (
			SELECT id, season, grand_prix, country, race_time,
			       ROW_NUMBER() OVER (PARTITION BY season ORDER BY race_time) AS round
			FROM races
		)
		SELECT rd.id, rd.round, rd.grand_prix, rd.country, rd.race_time, rd.season,
		       p.pole_driver_id, p.p1_driver_id, p.p2_driver_id, p.p3_driver_id,
		       rr.race_id IS NOT NULL AS resulted,
		       COALESCE(rr.pole_driver_id, ''), COALESCE(rr.p1_driver_id, ''),
		       COALESCE(rr.p2_driver_id, ''), COALESCE(rr.p3_driver_id, '')
		FROM predictions p
		JOIN rounds rd ON rd.id = p.race_id
		LEFT JOIN race_results rr ON rr.race_id = p.race_id
		WHERE p.user_id = $1 AND rd.race_time < $2
		ORDER BY rd.race_time DESC
	`
	rows, err := r.db.Query(ctx, query, userID, finishedBefore)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]domain.PlayerRaceEntry, 0)
	for rows.Next() {
		var e domain.PlayerRaceEntry
		var pred domain.Prediction
		var res domain.RaceResult
		if err := rows.Scan(
			&e.RaceID, &e.Round, &e.GrandPrix, &e.Country, &e.RaceTime, &e.Season,
			&pred.PoleDriverID, &pred.P1DriverID, &pred.P2DriverID, &pred.P3DriverID,
			&e.Resulted, &res.PoleDriverID, &res.P1DriverID, &res.P2DriverID, &res.P3DriverID,
		); err != nil {
			return nil, err
		}

		if e.Resulted {
			// Recomputed rather than read from race_scores so a row's per-slot
			// points always add up to its total, even if the stored score is stale.
			e.Breakdown = domain.ScorePrediction(&pred, &res)
		} else {
			// Nothing to measure against yet, but the picks are worth showing.
			e.Breakdown = domain.PredictionBreakdown{
				Pole: domain.SlotComparison{Predicted: pred.PoleDriverID},
				P1:   domain.SlotComparison{Predicted: pred.P1DriverID},
				P2:   domain.SlotComparison{Predicted: pred.P2DriverID},
				P3:   domain.SlotComparison{Predicted: pred.P3DriverID},
			}
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
