package route

import (
	"github.com/google/uuid"
)

func randomID() (string, error) {
	return uuid.New().String(), nil
}
