package models

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	bs "soci-backend/bootstrap"

	_ "github.com/go-sql-driver/mysql"
)

var testingDBInitOnce sync.Once
var testingDBInitErr error
var testingDBTables []string

func setupTestingDB() error {
	var testingDBName = "socidb_testing"
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
			fmt.Println("bootstrap died", err)
			testingDBInitErr = err
			return
		}

		DBConn = c.DBConn
		Log = c.Logger // so we don't choke on any log calls
		ServerFee = 1

		// Get the database schema back to square 1 once, then run all migrations once.
		resetTestingDB()

		goPath := os.Getenv("GOPATH")
		command := filepath.Join(goPath, "bin", "goose")
		if goPath == "" {
			command = "goose"
		}
		cmd := exec.Command(command, "mysql", os.Getenv("DB_USER")+":"+os.Getenv("DB_PASSWORD")+"@tcp("+os.Getenv("DB_HOST")+":"+os.Getenv("DB_PORT")+")/"+testingDBName, "up")

		_, b, _, _ := runtime.Caller(0)
		basepath := filepath.Dir(b)
		workingDir := strings.Replace(basepath, "models", "migrations", -1)
		cmd.Dir = workingDir

		var output bytes.Buffer
		cmd.Stderr = &output
		err = cmd.Run()
		if err != nil {
			testingDBInitErr = fmt.Errorf("%w: %s", err, output.String())
		}

		// Cache table list for fast per-test truncation.
		var tables []string
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

	// Between tests, wipe data quickly (keep schema/migrations).
	wipeTestingDB()

	return nil
}

func resetTestingDB() {
	DBConn.Exec("SET FOREIGN_KEY_CHECKS=0")

	var tables []string
	DBConn.Select(&tables, "SHOW TABLES")
	for _, t := range tables {
		_, err := DBConn.Exec("DROP TABLE `" + t + "`")
		if err != nil {
			panic(err)
		}
	}
	DBConn.Exec("SET FOREIGN_KEY_CHECKS=1")
}

func wipeTestingDB() {
	DBConn.Exec("SET FOREIGN_KEY_CHECKS=0")

	for _, t := range testingDBTables {
		_, err := DBConn.Exec("TRUNCATE TABLE `" + t + "`")
		if err != nil {
			panic(err)
		}
	}

	DBConn.Exec("SET FOREIGN_KEY_CHECKS=1")
}
