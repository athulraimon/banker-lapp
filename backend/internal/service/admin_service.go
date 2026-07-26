package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/external"
	"banker_lapp_backend/internal/repository"
)

// timeBasedStatus derives the prediction-window status of a race from its FP1
// time (the moment predictions lock). "completed" is never returned here — that
// state only comes from official results being present.
func timeBasedStatus(race *domain.Race) string {
	now := time.Now()
	switch {
	case now.After(race.FP1Time):
		return "locked"
	case now.After(race.FP1Time.Add(-7 * 24 * time.Hour)):
		return "open"
	default:
		return "upcoming"
	}
}

type AdminService struct {
	raceRepo   *repository.RaceRepository
	resultRepo *repository.ResultRepository
	scoreRepo  *repository.ScoreRepository
	predRepo   *repository.PredictionRepository
	userRepo   *repository.UserRepository
	scoringSvc *ScoringService
	openf1     *external.OpenF1Client
}

func NewAdminService(
	raceRepo *repository.RaceRepository,
	resultRepo *repository.ResultRepository,
	scoreRepo *repository.ScoreRepository,
	predRepo *repository.PredictionRepository,
	userRepo *repository.UserRepository,
	scoringSvc *ScoringService,
) *AdminService {
	return &AdminService{
		raceRepo:   raceRepo,
		resultRepo: resultRepo,
		scoreRepo:  scoreRepo,
		predRepo:   predRepo,
		userRepo:   userRepo,
		scoringSvc: scoringSvc,
		openf1:     external.NewOpenF1Client(),
	}
}

// SyncSchedule pulls the real Grand Prix calendar for the season from OpenF1
// and upserts each race weekend. Returns the number of races synced.
func (s *AdminService) SyncSchedule(ctx context.Context, season int) (int, error) {
	races, err := s.openf1.FetchRaceWeekends(ctx, season)
	if err != nil {
		return 0, fmt.Errorf("fetch schedule: %w", err)
	}
	for i := range races {
		if err := s.raceRepo.UpsertRace(ctx, &races[i]); err != nil {
			return 0, fmt.Errorf("upsert race %s: %w", races[i].GrandPrix, err)
		}
	}
	log.Printf("[admin] synced %d races for season %d", len(races), season)
	return len(races), nil
}

// SetRaceResults records the official podium+pole for a race, marks it complete,
// and immediately recalculates every user's score for that race.
func (s *AdminService) SetRaceResults(ctx context.Context, raceID string, result *domain.RaceResult) error {
	race, err := s.raceRepo.GetRaceByID(ctx, raceID)
	if err != nil {
		return err
	}
	if race == nil {
		return errors.New("race not found")
	}
	// Slots may be left empty ("None"); unset positions simply score no points.
	result.RaceID = raceID
	if err := s.resultRepo.UpsertRaceResult(ctx, result); err != nil {
		return fmt.Errorf("save results: %w", err)
	}
	if err := s.raceRepo.UpdateStatus(ctx, raceID, "completed"); err != nil {
		return fmt.Errorf("mark completed: %w", err)
	}
	return s.RecalculateScores(ctx, raceID)
}

// RecalculateScores re-runs the scoring engine for every prediction submitted
// for the race. Safe to run repeatedly.
func (s *AdminService) RecalculateScores(ctx context.Context, raceID string) error {
	result, err := s.resultRepo.GetRaceResult(ctx, raceID)
	if err != nil {
		return err
	}
	if result == nil {
		return errors.New("cannot score a race that has no results yet")
	}

	predictions, err := s.predRepo.GetAllPredictionsForRace(ctx, raceID)
	if err != nil {
		return err
	}
	for _, p := range predictions {
		if _, err := s.scoringSvc.CalculateScore(ctx, p.UserID, raceID); err != nil {
			return fmt.Errorf("score user %s: %w", p.UserID, err)
		}
	}
	log.Printf("[admin] recalculated %d scores for race %s", len(predictions), raceID)
	return nil
}

// ClearRaceResults removes a race's official result and all scores derived from
// it, reverting the race to "locked" (past FP1, awaiting results).
func (s *AdminService) ClearRaceResults(ctx context.Context, raceID string) error {
	race, err := s.raceRepo.GetRaceByID(ctx, raceID)
	if err != nil {
		return err
	}
	if race == nil {
		return errors.New("race not found")
	}
	if err := s.scoreRepo.DeleteRaceScores(ctx, raceID); err != nil {
		return fmt.Errorf("delete scores: %w", err)
	}
	if err := s.resultRepo.DeleteRaceResult(ctx, raceID); err != nil {
		return fmt.Errorf("delete result: %w", err)
	}
	if err := s.raceRepo.UpdateStatus(ctx, raceID, timeBasedStatus(race)); err != nil {
		return fmt.Errorf("reset status: %w", err)
	}
	log.Printf("[admin] cleared results for race %s", raceID)
	return nil
}

// AdminPredictionView is one user's prediction annotated with their name.
type AdminPredictionView struct {
	UserID      string             `json:"user_id"`
	DisplayName string             `json:"display_name"`
	Email       string             `json:"email"`
	Prediction  *domain.Prediction `json:"prediction"`
}

// ListRacePredictions returns every registered user with their prediction (if
// any) for the race, so the admin can review and edit entries.
func (s *AdminService) ListRacePredictions(ctx context.Context, raceID string) ([]AdminPredictionView, error) {
	users, err := s.userRepo.ListUsers(ctx)
	if err != nil {
		return nil, err
	}
	preds, err := s.predRepo.GetAllPredictionsForRace(ctx, raceID)
	if err != nil {
		return nil, err
	}
	byUser := map[string]domain.Prediction{}
	for _, p := range preds {
		byUser[p.UserID] = p
	}

	views := make([]AdminPredictionView, 0, len(users))
	for _, u := range users {
		view := AdminPredictionView{UserID: u.ID, DisplayName: u.DisplayName, Email: u.Email}
		if p, ok := byUser[u.ID]; ok {
			pc := p
			view.Prediction = &pc
		}
		views = append(views, view)
	}
	return views, nil
}

// AdminUpsertPrediction writes/overwrites a user's prediction, bypassing the
// FP1 lock, then rescoring the race if results already exist.
func (s *AdminService) AdminUpsertPrediction(ctx context.Context, p *domain.Prediction) error {
	if err := validateDistinctDrivers(p); err != nil {
		return err
	}
	race, err := s.raceRepo.GetRaceByID(ctx, p.RaceID)
	if err != nil {
		return err
	}
	if race == nil {
		return errors.New("race not found")
	}
	user, err := s.userRepo.GetUserByID(ctx, p.UserID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	if err := s.predRepo.AdminUpsertPrediction(ctx, p); err != nil {
		return err
	}

	// Keep scores consistent if the race is already resulted.
	if result, err := s.resultRepo.GetRaceResult(ctx, p.RaceID); err == nil && result != nil {
		if _, err := s.scoringSvc.CalculateScore(ctx, p.UserID, p.RaceID); err != nil {
			return err
		}
	}
	return nil
}

// validateDistinctDrivers ensures the podium (P1/P2/P3) has no repeats. Pole is
// intentionally excluded: the pole-sitter commonly also wins the race.
func validateDistinctDrivers(p *domain.Prediction) error {
	seen := map[string]bool{}
	for _, d := range []string{p.P1DriverID, p.P2DriverID, p.P3DriverID} {
		if d == "" {
			continue
		}
		if seen[d] {
			return errors.New("a driver can only appear once on the podium (P1/P2/P3)")
		}
		seen[d] = true
	}
	return nil
}
