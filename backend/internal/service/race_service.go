package service

import (
	"context"
	"time"

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

// GetRacesForSeason returns the season's races with their prediction-window
// status recomputed from the current time.
//
// The stored status is only a snapshot from the last schedule sync. Deriving it
// here means the badge is correct the moment FP1 starts, with no cron job and
// no writes — and it matches what prediction_service enforces on submission,
// which has always compared against FP1Time directly.
func (s *RaceService) GetRacesForSeason(ctx context.Context, season int) ([]domain.Race, error) {
	races, err := s.repo.GetRacesBySeason(ctx, season)
	if err != nil {
		return nil, err
	}
	return domain.DeriveSeasonStatuses(races, time.Now()), nil
}

// GetRaceByID returns a single race with the same derived status as the list
// view.
//
// It loads the season to do so, because a race's window opens when the previous
// race ends and that is not knowable from the row alone. One extra query for a
// 22 row table is a fair price for the detail screen never disagreeing with the
// dashboard about whether a race is open.
func (s *RaceService) GetRaceByID(ctx context.Context, id string) (*domain.Race, error) {
	race, err := s.repo.GetRaceByID(ctx, id)
	if err != nil || race == nil {
		return race, err
	}

	season, err := s.repo.GetRacesBySeason(ctx, race.Season)
	if err != nil {
		// The row itself is still useful; fall back to the stored status.
		return race, nil
	}

	for _, r := range domain.DeriveSeasonStatuses(season, time.Now()) {
		if r.ID == race.ID {
			derived := r
			return &derived, nil
		}
	}
	return race, nil
}

type RaceResultWithPredictions struct {
	RaceResult *domain.RaceResult `json:"race_result"`
	Predictions []domain.Prediction `json:"predictions"`
	RaceScores []domain.RaceScore `json:"race_scores"`
}

// GetRaceResults returns the official podium, and — only when includePlayers is
// set — what everyone predicted and scored. Guests get the F1 result, which is
// public knowledge anyway, without the league's picks and names attached.
func (s *RaceService) GetRaceResults(ctx context.Context, id string, includePlayers bool) (*RaceResultWithPredictions, error) {
	result, err := s.resultRepo.GetRaceResult(ctx, id)
	if err != nil {
		return nil, err
	}

	if !includePlayers {
		// Empty slices rather than nil: the app renders `predictions.length`
		// without a guard, and JSON null would crash it.
		return &RaceResultWithPredictions{
			RaceResult:  result,
			Predictions: []domain.Prediction{},
			RaceScores:  []domain.RaceScore{},
		}, nil
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
