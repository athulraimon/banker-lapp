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
}

func NewScheduler(tokens *repository.RefreshTokenRepository) *Scheduler {
	c := cron.New(cron.WithChain(cron.Recover(cron.DefaultLogger)))
	return &Scheduler{cron: c, tokens: tokens}
}

func (s *Scheduler) Start() {
	// Sync race schedule daily at 06:00 UTC
	if _, err := s.cron.AddFunc("0 6 * * *", func() {
		log.Println("Running daily race schedule sync...")
	}); err != nil {
		log.Printf("Error adding cron job: %v", err)
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
