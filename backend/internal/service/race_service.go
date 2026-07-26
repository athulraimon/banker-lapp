package service

import (
	"context"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/repository"
)

type RaceService struct {
	repo      *repository.RaceRepository
	resultRepo *repository.ResultRepository
	scoreRepo  *repository.ScoreRepository
	predRepo   *repository.PredictionRepository
}

func NewRaceService(repo *repository.RaceRepository, resultRepo *repository.ResultRepository, scoreRepo *repository.ScoreRepository, predRepo *repository.PredictionRepository) *RaceService {
	return &RaceService{
		repo:      repo,
		resultRepo: resultRepo,
		scoreRepo:   scoreRepo,
		predRepo:   predRepo,
	}
}

func (s *RaceService) GetRacesForSeason(ctx context.Context, season int) ([]domain.Race, error) {
	// In the real app, we'd cache this in Redis. For now, fetch direct.
	return s.repo.GetRacesBySeason(ctx, season)
}

func (s *RaceService) GetRaceByID(ctx context.Context, id string) (*domain.Race, error) {
	return s.repo.GetRaceByID(ctx, id)
}

type RaceResultWithPredictions struct {
	RaceResult *domain.RaceResult `json:"race_result"`
	Predictions []domain.Prediction `json:"predictions"`
	RaceScores []domain.RaceScore `json:"race_scores"`
}

func (s *RaceService) GetRaceResults(ctx context.Context, id string) (*RaceResultWithPredictions, error) {
	result, err := s.resultRepo.GetRaceResult(ctx, id)
	if err != nil {
		return nil, err
	}
	
	predictions, err := s.predRepo.GetAllPredictionsForRace(ctx, id)
	if err != nil {
		return nil, err
	}
	
	scores, err := s.scoreRepo.GetRaceScores(ctx, id)
	if err != nil {
		return nil, err
	}
	
	return &RaceResultWithPredictions{
		RaceResult: result,
		Predictions: predictions,
		RaceScores: scores,
	}, nil
}
