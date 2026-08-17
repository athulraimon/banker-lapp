package scheduler

import (
	"context"
	"log"
	"time"

	"banker_lapp_backend/internal/repository"

	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron   *cron.Cron
	tokens *repository.RefreshTokenRepository
	// syncSchedule refreshes the season calendar from upstream. Injected rather
	// than depending on AdminService directly, which would import a service into
	// the scheduler and make the dependency cycle awkward.
	syncSchedule func(context.Context) error
}

func NewScheduler(tokens *repository.RefreshTokenRepository, syncSchedule func(context.Context) error) *Scheduler {
	c := cron.New(cron.WithChain(cron.Recover(cron.DefaultLogger)))
	return &Scheduler{cron: c, tokens: tokens, syncSchedule: syncSchedule}
}

func (s *Scheduler) Start() {
	// Sync the race schedule daily at 06:00 UTC.
	//
	// This job used to have an empty body that only logged, so a calendar change
	// upstream (a race added, dropped or renumbered) sat unnoticed until an admin
	// remembered to press Sync — while the log line claimed a sync had run.
	if s.syncSchedule != nil {
		if _, err := s.cron.AddFunc("0 6 * * *", func() {
			log.Println("Running daily race schedule sync...")
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()
			if err := s.syncSchedule(ctx); err != nil {
				log.Printf("[scheduler] race schedule sync failed: %v", err)
				return
			}
			log.Println("[scheduler] race schedule sync complete")
		}); err != nil {
			log.Printf("Error adding cron job: %v", err)
		}
	}

	// Sweep expired refresh tokens nightly. Redis evicted these by TTL for free;
	// with Postgres we have to delete them ourselves or the table grows forever.
	//
	// The old every-minute "lock predictions" job was removed: it had an empty
	// body, and prediction locking is already enforced per-request against the
	// FP1 time. Waking every 60s would also defeat scale-to-zero hosting.
	if _, err := s.cron.AddFunc("30 3 * * *", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		n, err := s.tokens.DeleteExpired(ctx)
		if err != nil {
			log.Printf("[scheduler] refresh token sweep failed: %v", err)
			return
		}
		if n > 0 {
			log.Printf("[scheduler] removed %d expired refresh tokens", n)
		}
	}); err != nil {
		log.Printf("Error adding cron job: %v", err)
	}

	s.cron.Start()
	log.Println("Scheduler started successfully")
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}
