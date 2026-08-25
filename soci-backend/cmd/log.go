package main

// Log is for basic logging
func log(message interface{}) {
	nonioConfig.Logger.Info(message)
}

// LogError is for basic errors
func logError(message interface{}) {
	nonioConfig.Logger.Error(message)
}
