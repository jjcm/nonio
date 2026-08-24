package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
)

// Config structure for server
type Config struct {
	Port    string `json:"port"`
	APIHost string `json:"api_host"`
}

var Settings Config

// copy the source to destination when not existed
func checkFileExists(source string, destination string) error {
	if _, err := os.Stat(destination); os.IsNotExist(err) {
		fmt.Println("No config detected. Setting sensible defaults for local development...")

		input, err := ioutil.ReadFile(source)
		if err != nil {
			return fmt.Errorf("source %s: %v", source, err)
		}

		if err = ioutil.WriteFile(destination, input, 0644); err != nil {
			return err
		}
	}

	return nil
}

// ParseJSONFile the config file
func ParseJSONFile(filename string, c *Config) error {
	source := filename + ".example"
	// check if the file is existed
	if err := checkFileExists(source, filename); err != nil {
		return err
	}

	// read and unmarshal file
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, c)
}

// Validate the config value
func (c *Config) Validate() error {
	if c.APIHost == "" {
		c.APIHost = "https://api.non.io"
	}

	return nil
}
