package service

import (
	"context"
	"log"
	"sync"
	"time"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/external"
)

const driverCacheTTL = 6 * time.Hour

// DriverService serves the current F1 grid from OpenF1, cached in memory so the
// prediction editor stays fast and resilient to OpenF1 hiccups.
//
// This used to be a Redis cache. The grid is one small list, identical for every
// user and cheap to refetch, so a process-local cache does the same job without
// a second service to host. On a scale-to-zero host the cache is lost when the
// instance sleeps, which costs exactly one OpenF1 call on the next cold start.
type DriverService struct {
	openf1 *external.OpenF1Client

	mu       sync.RWMutex
	cached   []domain.Driver
	cachedAt time.Time

	// inflight collapses concurrent misses into a single upstream fetch, so a
	// burst of requests after a cold start doesn't stampede OpenF1.
	inflight sync.Mutex
}

func NewDriverService() *DriverService {
	return &DriverService{openf1: external.NewOpenF1Client()}
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

	drivers, err := s.openf1.FetchLatestDrivers(ctx)
	if err != nil {
		// Serve stale data rather than failing the request if OpenF1 is down.
		if stale, _ := s.read(); len(stale) > 0 {
			log.Printf("[drivers] OpenF1 failed (%v), serving stale cache", err)
			return stale, nil
		}
		return nil, err
	}

	s.write(drivers)
	return drivers, nil
}
