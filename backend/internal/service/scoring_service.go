package service

import (
	"context"
	"time"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/repository"
)

type ScoringService struct {
	scoreRepo  *repository.ScoreRepository
	resultRepo *repository.ResultRepository
	predRepo   *repository.PredictionRepository
}

func NewScoringService(scoreRepo *repository.ScoreRepository, resultRepo *repository.ResultRepository, predRepo *repository.PredictionRepository) *ScoringService {
	return &ScoringService{
		scoreRepo:  scoreRepo,
		resultRepo: resultRepo,
		predRepo:   predRepo,
	}
}

// CalculateScore evaluates a user's prediction against actual race results
func (s *ScoringService) CalculateScore(ctx context.Context, userID, raceID string) (*domain.RaceScore, error) {
	pred, err := s.predRepo.GetUserPredictionForRace(ctx, userID, raceID)
	if err != nil {
		return nil, err
	}

	res, err := s.resultRepo.GetRaceResult(ctx, raceID)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, nil // Cannot score without results
	}

	// The 5/15/10/8 table lives in domain.ScorePrediction, which the player
	// profile also uses, so the leaderboard and a player's own breakdown can
	// never disagree about what a pick was worth.
	breakdown := domain.ScorePrediction(pred, res)

	score := &domain.RaceScore{
		UserID:        userID,
		RaceID:        raceID,
		Points:        breakdown.Points,
		CorrectWinner: breakdown.CorrectWinner,
	}

	err = s.scoreRepo.UpsertRaceScore(ctx, score)
	if err != nil {
		return nil, err
	}

	return score, nil
}

func (s *ScoringService) GetGlobalStandings(ctx context.Context) ([]domain.Standing, error) {
	return s.scoreRepo.GetGlobalStandings(ctx)
}

// GetPlayerProfile assembles one player's season: their standing, how often each
// slot was called correctly, and the race-by-race history behind it.
//
// Rank and total points come from the standings query rather than being summed
// from the history, so the headline figures match the leaderboard row the player
// was tapped from. The per-race rows are recomputed from picks against results.
func (s *ScoringService) GetPlayerProfile(ctx context.Context, userID string) (*domain.PlayerProfile, error) {
	standings, err := s.scoreRepo.GetGlobalStandings(ctx)
	if err != nil {
		return nil, err
	}

	profile := &domain.PlayerProfile{UserID: userID}
	found := false
	for _, st := range standings {
		if st.UserID == userID {
			profile.UserName = st.UserName
			profile.Rank = st.Rank
			profile.TotalPoints = st.TotalPoints
			found = true
			break
		}
	}
	if !found {
		return nil, nil // no such player; the handler turns this into a 404
	}

	// Only races that have actually finished, so this never exposes a live pick.
	entries, err := s.scoreRepo.GetPlayerCompletedRaces(ctx, userID, time.Now().Add(-domain.RaceDuration))
	if err != nil {
		return nil, err
	}
	profile.Entries = entries

	for _, e := range entries {
		// A finished race still awaiting its official result cannot count for or
		// against anyone, so it stays out of every denominator.
		if !e.Resulted {
			continue
		}
		profile.RacesScored++

		b := e.Breakdown
		if b.Pole.Hit {
			profile.PoleHits++
		}
		if b.P1.Hit {
			profile.P1Hits++
		}
		if b.P2.Hit {
			profile.P2Hits++
		}
		if b.P3.Hit {
			profile.P3Hits++
		}
	}

	return profile, nil
}
