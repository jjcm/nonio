package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseJSONFileCopiesTheExampleWhenMissing(t *testing.T) {
	dir := t.TempDir()
	example := filepath.Join(dir, "config.json.example")
	target := filepath.Join(dir, "config.json")
	os.WriteFile(example, []byte(`{"port":"4202","api_host":"http://localhost:4201"}`), 0644)

	c := Config{}
	if err := ParseJSONFile(target, &c); err != nil {
		t.Fatalf("Parsing should copy the example and succeed. Error: %v", err)
	}
	if c.Port != "4202" || c.APIHost != "http://localhost:4201" {
		t.Errorf("The example values should be parsed, got %+v", c)
	}
	if _, err := os.Stat(target); err != nil {
		t.Errorf("config.json should have been created from the example")
	}
}

func TestParseJSONFilePrefersTheExistingConfig(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "config.json.example"), []byte(`{"port":"1111"}`), 0644)
	os.WriteFile(filepath.Join(dir, "config.json"), []byte(`{"port":"2222"}`), 0644)

	c := Config{}
	if err := ParseJSONFile(filepath.Join(dir, "config.json"), &c); err != nil {
		t.Fatalf("Parsing should succeed. Error: %v", err)
	}
	if c.Port != "2222" {
		t.Errorf("The existing config should win over the example, got %v", c.Port)
	}
}

func TestValidateDefaultsTheAPIHost(t *testing.T) {
	c := Config{}
	c.Validate()
	if c.APIHost == "" {
		t.Errorf("An empty api_host should fall back to a default")
	}

	c = Config{APIHost: "http://localhost:4201"}
	c.Validate()
	if c.APIHost != "http://localhost:4201" {
		t.Errorf("A configured api_host should be kept, got %v", c.APIHost)
	}
}
