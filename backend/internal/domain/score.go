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
