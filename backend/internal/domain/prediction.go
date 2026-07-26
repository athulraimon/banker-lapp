package domain

import "time"

type Prediction struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	RaceID       string    `json:"race_id"`
	PoleDriverID string    `json:"pole_driver_id"`
	P1DriverID   string    `json:"p1_driver_id"`
	P2DriverID   string    `json:"p2_driver_id"`
	P3DriverID   string    `json:"p3_driver_id"`
	Locked       bool      `json:"locked"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
