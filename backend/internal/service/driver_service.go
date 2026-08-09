package service

import (
	"context"
	"log"
	"sync"
	"time"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/external"
	"banker_lapp_backend/internal/repository"
)

const driverCacheTTL = 6 * time.Hour

// Standings change only when a race is scored, so a short TTL keeps them fresh
// without hammering the upstream API.
const driverStandingsTTL = 15 * time.Minute

// DriverService serves the current F1 grid from the Jolpica F1 API, cached in
// memory so the prediction editor stays fast and resilient to upstream hiccups.
//
// This used to be a Redis cache. The grid is one small list, identical for every
// user and cheap to refetch, so a process-local cache does the same job without
// a second service to host. On a scale-to-zero host the cache is lost when the
// instance sleeps, which costs exactly one upstream call on the next cold start.
type DriverService struct {
	f1            *external.F1Client
	season        int
	standingsRepo *repository.DriverStandingsRepository

	mu       sync.RWMutex
	cached   []domain.Driver
	cachedAt time.Time

	// inflight collapses concurrent misses into a single upstream fetch, so a
	// burst of requests after a cold start doesn't stampede the upstream API.
	inflight sync.Mutex
}

func NewDriverService(season int, standingsRepo *repository.DriverStandingsRepository) *DriverService {
	return &DriverService{f1: external.NewF1Client(), season: season, standingsRepo: standingsRepo}
}

// read returns the cached grid and whether it is still within its TTL.
func (s *DriverService) read() (drivers []domain.Driver, fresh bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.cached) == 0 {
		return nil, false
	}
	return s.cached, time.Since(s.cachedAt) < driverCacheTTL
}

func (s *DriverService) write(drivers []domain.Driver) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cached = drivers
	s.cachedAt = time.Now()
}

func (s *DriverService) GetDrivers(ctx context.Context) ([]domain.Driver, error) {
	if drivers, fresh := s.read(); fresh {
		return drivers, nil
	}

	s.inflight.Lock()
	defer s.inflight.Unlock()

	// Another goroutine may have refreshed while we waited for the lock.
	if drivers, fresh := s.read(); fresh {
		return drivers, nil
	}

	drivers, err := s.f1.FetchLatestDrivers(ctx, s.season)
	if err != nil {
		// Serve stale data rather than failing the request if upstream is down.
		if stale, _ := s.read(); len(stale) > 0 {
			log.Printf("[drivers] upstream failed (%v), serving stale cache", err)
			return stale, nil
		}
		return nil, err
	}

	s.write(drivers)
	return drivers, nil
}

// GetDriverStandings returns the official F1 Drivers' Championship table. The
// persisted copy in Postgres is the cache: it is served while fresh, refreshed
// from the upstream API when stale, and served stale if the upstream is down —
// so the table survives a cold start and outages alike.
func (s *DriverService) GetDriverStandings(ctx context.Context) ([]domain.DriverStanding, error) {
	if stored, updatedAt, err := s.standingsRepo.Get(ctx, s.season); err == nil &&
		len(stored) > 0 && time.Since(updatedAt) < driverStandingsTTL {
		return stored, nil
	}

	s.inflight.Lock()
	defer s.inflight.Unlock()

	// Re-check after acquiring the lock — another request may have refreshed.
	stored, updatedAt, _ := s.standingsRepo.Get(ctx, s.season)
	if len(stored) > 0 && time.Since(updatedAt) < driverStandingsTTL {
		return stored, nil
	}

	fresh, err := s.f1.FetchDriverStandings(ctx, s.season)
	if err != nil {
		if len(stored) > 0 {
			log.Printf("[driver-standings] upstream failed (%v), serving persisted copy", err)
			return stored, nil
		}
		return nil, err
	}

	if len(fresh) > 0 {
		if err := s.standingsRepo.Replace(ctx, s.season, fresh); err != nil {
			log.Printf("[driver-standings] persist failed: %v", err)
		}
	}
	return fresh, nil
}
