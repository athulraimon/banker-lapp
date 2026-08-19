package domain

import "time"

type User struct {
	ID          string    `json:"id"`
	GoogleID    string    `json:"google_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	PhotoURL    string    `json:"photo_url"`
	IsAdmin     bool      `json:"is_admin"`
	CreatedAt   time.Time `json:"created_at"`
}

// AdminAccount is one registered player as the admin panel lists them.
//
// Carries the prediction and points totals because the only action offered next
// to it is deletion: an admin about to remove somebody should be able to see how
// much history goes with them without opening another screen.
type AdminAccount struct {
	UserID      string    `json:"user_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	IsAdmin     bool      `json:"is_admin"`
	CreatedAt   time.Time `json:"created_at"`
	Predictions int       `json:"predictions"`
	TotalPoints int       `json:"total_points"`
}
