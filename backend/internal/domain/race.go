package domain

import "time"

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

type Driver struct {
	DriverID     string `json:"driver_id"` // Used in predictions, usually driver_number or acronym
	BroadcastName string `json:"broadcast_name"`
	TeamName      string `json:"team_name"`
	TeamColor     string `json:"team_color"`
}
