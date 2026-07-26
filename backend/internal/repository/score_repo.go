package repository

import (
	"context"

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
