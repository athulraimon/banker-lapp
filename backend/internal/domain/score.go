package domain

import "time"

type RaceResult struct {
	ID           string    `json:"id"`
	RaceID       string    `json:"race_id"`
	PoleDriverID string    `json:"pole_driver_id"`
	P1DriverID   string    `json:"p1_driver_id"`
	P2DriverID   string    `json:"p2_driver_id"`
	P3DriverID   string    `json:"p3_driver_id"`
	FetchedAt    time.Time `json:"fetched_at"`
}

type RaceScore struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	UserName      string    `json:"user_name"`
	RaceID        string    `json:"race_id"`
	Points        int       `json:"points"`
	CorrectWinner bool      `json:"correct_winner"`
	CalculatedAt  time.Time `json:"calculated_at"`
}

type Standing struct {
	Rank           int    `json:"rank"`
	UserID         string `json:"user_id"`
	UserName       string `json:"user_name"`
	TotalPoints    int    `json:"total_points"`
	CorrectWinners int    `json:"correct_winners"`
	PoleCount      int    `json:"pole_count"`
}

// Points awarded for each slot called correctly. Pole is worth least and the
// race winner most, with the rest of the podium in between.
const (
	PointsPole = 5
	PointsP1   = 15
	PointsP2   = 10
	PointsP3   = 8
)

// SlotComparison is one predicted position measured against the official result.
type SlotComparison struct {
	Predicted string `json:"predicted"`
	Actual    string `json:"actual"`
	Hit       bool   `json:"hit"`
	Points    int    `json:"points"`
}

func compareSlot(predicted, actual string, points int) SlotComparison {
	// An empty pick is a non-entry, not a miss against an empty result: both
	// being "" must never count as a hit.
	hit := predicted != "" && predicted == actual
	c := SlotComparison{Predicted: predicted, Actual: actual, Hit: hit}
	if hit {
		c.Points = points
	}
	return c
}

// PredictionBreakdown is a whole prediction measured against a race result.
type PredictionBreakdown struct {
	Pole          SlotComparison `json:"pole"`
	P1            SlotComparison `json:"p1"`
	P2            SlotComparison `json:"p2"`
	P3            SlotComparison `json:"p3"`
	Points        int            `json:"points"`
	Hits          int            `json:"hits"`
	CorrectWinner bool           `json:"correct_winner"`
}

// ScorePrediction applies the scoring rules to one prediction.
//
// Shared by the scoring engine and the player profile so the two can never
// disagree about what a pick was worth — previously the 5/15/10/8 table was
// written out separately in each place that needed it. A nil prediction scores
// zero rather than erroring: a player who never entered simply earned nothing.
func ScorePrediction(p *Prediction, res *RaceResult) PredictionBreakdown {
	if res == nil {
		return PredictionBreakdown{}
	}
	var pole, p1, p2, p3 string
	if p != nil {
		pole, p1, p2, p3 = p.PoleDriverID, p.P1DriverID, p.P2DriverID, p.P3DriverID
	}

	b := PredictionBreakdown{
		Pole: compareSlot(pole, res.PoleDriverID, PointsPole),
		P1:   compareSlot(p1, res.P1DriverID, PointsP1),
		P2:   compareSlot(p2, res.P2DriverID, PointsP2),
		P3:   compareSlot(p3, res.P3DriverID, PointsP3),
	}
	for _, s := range []SlotComparison{b.Pole, b.P1, b.P2, b.P3} {
		b.Points += s.Points
		if s.Hit {
			b.Hits++
		}
	}
	b.CorrectWinner = b.P1.Hit
	return b
}

// PlayerRaceEntry is one finished race the player entered: what they called, what
// actually happened, and what it was worth.
//
// Resulted is false for a race that has finished but whose official result an
// admin has not entered yet. Without the flag such a row is indistinguishable
// from one where every pick simply missed, which is the opposite conclusion.
type PlayerRaceEntry struct {
	RaceID    string              `json:"race_id"`
	Round     int                 `json:"round"`
	GrandPrix string              `json:"grand_prix"`
	Country   string              `json:"country"`
	RaceTime  time.Time           `json:"race_time"`
	Season    int                 `json:"season"`
	Resulted  bool                `json:"resulted"`
	Breakdown PredictionBreakdown `json:"breakdown"`
}

// PlayerProfile is a single player's season: headline standing, how often each
// slot was called right, and the race-by-race history behind it.
type PlayerProfile struct {
	UserID      string `json:"user_id"`
	UserName    string `json:"user_name"`
	Rank        int    `json:"rank"`
	TotalPoints int    `json:"total_points"`
	// Entered races that have been resulted, and so the denominator for every hit
	// count below. Not the length of Entries, which also covers finished races
	// still waiting on their official result.
	RacesScored int               `json:"races_scored"`
	PoleHits    int               `json:"pole_hits"`
	P1Hits      int               `json:"p1_hits"`
	P2Hits      int               `json:"p2_hits"`
	P3Hits      int               `json:"p3_hits"`
	Entries     []PlayerRaceEntry `json:"entries"`
}
