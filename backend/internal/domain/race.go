package domain

import "time"

// Race workflow statuses.
//
// The first three describe the prediction window and are a pure function of the
// clock. StatusCompleted is different in kind: it means an admin has entered
// official results, which is a fact about stored data, not about time.
const (
	StatusUpcoming  = "upcoming"
	StatusOpen      = "open"
	StatusLocked    = "locked"
	StatusCompleted = "completed"
)

// RaceDuration is how long after lights out a Grand Prix is treated as finished.
// The FIA's maximum race time is three hours, but a normal race runs well under
// two; 2h15m is the point where the previous weekend stops being interesting and
// the next one becomes the active Grand Prix.
const RaceDuration = 2*time.Hour + 15*time.Minute

type Race struct {
	ID             string    `json:"id"`
	APIRaceID      string    `json:"api_race_id"`
	GrandPrix      string    `json:"grand_prix"`
	CircuitName    string    `json:"circuit_name"`
	Country        string    `json:"country"`
	FP1Time        time.Time `json:"fp1_time"`
	QualifyingTime time.Time `json:"qualifying_time"`
	RaceTime       time.Time `json:"race_time"`
	Season         int       `json:"season"`
	Status         string    `json:"status"` // "upcoming", "open", "locked", "completed"
}

// IsOver reports whether the race has finished, and therefore whether the next
// Grand Prix should take over as the active one.
func (r Race) IsOver(now time.Time) bool {
	return now.After(r.RaceTime.Add(RaceDuration))
}

// PredictionWindowStatus reports where `now` sits for a race whose prediction
// window opens at openFrom.
//
// openFrom is the end of the *previous* race rather than a fixed lead time. The
// season is a continuous relay: the moment one race finishes, the next becomes
// the active Grand Prix and starts taking predictions. A zero openFrom means
// nothing precedes this race, so it is open immediately.
func PredictionWindowStatus(fp1, openFrom, now time.Time) string {
	switch {
	case now.After(fp1):
		return StatusLocked
	case openFrom.IsZero() || now.After(openFrom):
		return StatusOpen
	default:
		return StatusUpcoming
	}
}

// DeriveSeasonStatuses recomputes the status of every race in a season.
//
// This works on the whole season rather than one race at a time because a
// race's window now depends on when the previous one finished. Races must be
// ordered by race time; the repository already returns them that way.
//
// A completed race is left untouched: official results outrank the clock, and
// recomputing would flip a finished race back to "locked".
func DeriveSeasonStatuses(races []Race, now time.Time) []Race {
	out := make([]Race, len(races))
	copy(out, races)

	for i := range out {
		if out[i].Status == StatusCompleted {
			continue
		}
		// The window opens when the previous race ends. Round 1 has no
		// predecessor, so it is open as soon as the season is loaded.
		var openFrom time.Time
		if i > 0 {
			openFrom = out[i-1].RaceTime.Add(RaceDuration)
		}
		out[i].Status = PredictionWindowStatus(out[i].FP1Time, openFrom, now)
	}
	return out
}

type Driver struct {
	DriverID     string `json:"driver_id"` // Used in predictions, usually driver_number or acronym
	BroadcastName string `json:"broadcast_name"`
	TeamName      string `json:"team_name"`
	TeamColor     string `json:"team_color"`
}
