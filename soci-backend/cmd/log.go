package main

// Log is for basic logging
func log(message interface{}) {
	sociConfig.Logger.Info(message)
}

// LogError is for basic errors
func logError(message interface{}) {
	sociConfig.Logger.Error(message)
}
