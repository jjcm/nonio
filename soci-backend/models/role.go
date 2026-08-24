package models

import (
	"encoding/json"
	"time"
)

// Role - code representation of a user's role
type Role struct {
	ID        int       `db:"id" json:"-"`
	UserID    int       `db:"user_id" json:"-"`
	Role      string    `db:"role" json:"role"`
	CreatedAt time.Time `db:"created_at" json:"-"`
}

func (r *Role) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.Role)
}
