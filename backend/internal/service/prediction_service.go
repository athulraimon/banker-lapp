package service

import (
	"context"
	"errors"
	"time"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/repository"
)

type PredictionService struct {
	predRepo *repository.PredictionRepository
	raceRepo *repository.RaceRepository
}

func NewPredictionService(predRepo *repository.PredictionRepository, raceRepo *repository.RaceRepository) *PredictionService {
	return &PredictionService{predRepo: predRepo, raceRepo: raceRepo}
}

func (s *PredictionService) SubmitPrediction(ctx context.Context, p *domain.Prediction) error {
	// The podium (P1/P2/P3) must be three different drivers. Pole is separate:
	// the pole-sitter often also wins, so it may repeat a podium driver.
	drivers := map[string]bool{}
	for _, d := range []string{p.P1DriverID, p.P2DriverID, p.P3DriverID} {
		if d == "" {
			continue
		}
		if drivers[d] {
			return errors.New("a driver can only appear once on the podium (P1/P2/P3)")
		}
		drivers[d] = true
	}

	// Check FP1 Lock Time
	race, err := s.raceRepo.GetRaceByID(ctx, p.RaceID)
	if err != nil {
		return err
	}
	if race == nil {
		return errors.New("race not found")
	}

	if time.Now().After(race.FP1Time) {
		return errors.New("predictions are locked for this race (FP1 has started)")
	}

	p.Locked = false
	return s.predRepo.UpsertPrediction(ctx, p)
}

func (s *PredictionService) GetUserPrediction(ctx context.Context, userID, raceID string) (*domain.Prediction, error) {
	return s.predRepo.GetUserPredictionForRace(ctx, userID, raceID)
}
