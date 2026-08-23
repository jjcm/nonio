package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	bs "soci-backend/bootstrap"
	"soci-backend/models"

	_ "github.com/go-sql-driver/mysql"
)

var testingDBInitOnce sync.Once
var testingDBInitErr error
var testingDBTables []string

// setupTestingDB mirrors the bootstrap in models/models_test.go for
// handler-level HTTP tests. It uses its own database (not socidb_testing)
// because 'go test ./...' runs this package in parallel with models, and
// sharing one database would let the suites truncate each other mid-test:
//
//	CREATE DATABASE socidb_handlers_testing;
//	GRANT ALL PRIVILEGES ON socidb_handlers_testing.* TO 'dbtestuser'@'localhost';
func setupTestingDB() {
	var testingDBName = "socidb_handlers_testing"
	os.Setenv("APP_KEY", "secret")
	os.Setenv("STRIPE_SECRET_KEY", "secret")
	os.Setenv("STRIPE_PUBLISHABLE_KEY", "secret")
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_PORT", "3306")
	os.Setenv("DB_USER", "dbtestuser")
	os.Setenv("DB_DATABASE", testingDBName)
	os.Setenv("DB_PASSWORD", "password")

	testingDBInitOnce.Do(func() {
		c, err := bs.InitConfig()
		if err != nil {
			testingDBInitErr = err
			return
		}

		DBConn = c.DBConn
		Log = c.Logger
		models.DBConn = c.DBConn
		models.Log = c.Logger
		models.ServerFee = 1

		DBConn.Exec("SET FOREIGN_KEY_CHECKS=0")
		var tables []string
		DBConn.Select(&tables, "SHOW TABLES")
		for _, t := range tables {
			if _, err := DBConn.Exec("DROP TABLE `" + t + "`"); err != nil {
				testingDBInitErr = err
				return
			}
		}
		DBConn.Exec("SET FOREIGN_KEY_CHECKS=1")

		goPath := os.Getenv("GOPATH")
		command := filepath.Join(goPath, "bin", "goose")
		if goPath == "" {
			command = "goose"
		}
		cmd := exec.Command(command, "mysql", os.Getenv("DB_USER")+":"+os.Getenv("DB_PASSWORD")+"@tcp("+os.Getenv("DB_HOST")+":"+os.Getenv("DB_PORT")+")/"+testingDBName, "up")

		_, b, _, _ := runtime.Caller(0)
		cmd.Dir = filepath.Join(filepath.Dir(b), "..", "..", "migrations")

		var output bytes.Buffer
		cmd.Stderr = &output
		if err := cmd.Run(); err != nil {
			testingDBInitErr = fmt.Errorf("%w: %s", err, output.String())
			return
		}

		DBConn.Select(&tables, "SHOW TABLES")
		for _, t := range tables {
			if strings.HasPrefix(t, "goose_") {
				continue
			}
			testingDBTables = append(testingDBTables, t)
		}
	})

	if testingDBInitErr != nil {
		panic(testingDBInitErr)
	}

	DBConn.Exec("SET FOREIGN_KEY_CHECKS=0")
	for _, t := range testingDBTables {
		if _, err := DBConn.Exec("TRUNCATE TABLE `" + t + "`"); err != nil {
			panic(err)
		}
	}
	DBConn.Exec("SET FOREIGN_KEY_CHECKS=1")

	// the feed cache is process-global, so isolate tests from each other
	postCacheMu.Lock()
	PostCache = make(map[string]PostQueryResponse)
	postCacheMu.Unlock()
}

func decodeBody(rec *httptest.ResponseRecorder, v interface{}) error {
	return json.Unmarshal(rec.Body.Bytes(), v)
}

// withUser mimics the CheckToken middleware by putting the user id on the
// request context, so protected handlers can be exercised directly.
func withUser(userID int) context.Context {
	return context.WithValue(context.Background(), "user_id", userID)
}
