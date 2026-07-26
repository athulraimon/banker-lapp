package service

import (
	"context"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/repository"
)

type ScoringService struct {
	scoreRepo *repository.ScoreRepository
	resultRepo *repository.ResultRepository
	predRepo  *repository.PredictionRepository
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

	points := 0
	correctWinner := false

	if pred != nil {
		if pred.PoleDriverID != "" && pred.PoleDriverID == res.PoleDriverID {
			points += 5
		}
		if pred.P1DriverID != "" && pred.P1DriverID == res.P1DriverID {
			points += 15
			correctWinner = true
		}
		if pred.P2DriverID != "" && pred.P2DriverID == res.P2DriverID {
			points += 10
		}
		if pred.P3DriverID != "" && pred.P3DriverID == res.P3DriverID {
			points += 8
		}
	}

	score := &domain.RaceScore{
		UserID:        userID,
		RaceID:        raceID,
		Points:        points,
		CorrectWinner: correctWinner,
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
