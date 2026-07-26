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
