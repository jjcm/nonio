package utils

// MakeError - simple func to wrap an error in a json friendly map
func MakeError(message string) map[string]string {
	output := map[string]string{
		"error": message,
	}
	return output
}
