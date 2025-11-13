package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type ServiceStatus string

const (
	StatusStopped  ServiceStatus = "stopped"
	StatusStarting ServiceStatus = "starting"
	StatusRunning  ServiceStatus = "running"
	StatusError    ServiceStatus = "error"
)

type Service struct {
	Name        string
	Port        string
	Status      ServiceStatus
	Cmd         *exec.Cmd
	Cancel      context.CancelFunc
	Logs        []string
	LogsMutex   sync.Mutex
	LastError   string
	StartTime   time.Time
	HealthCheck func() bool
	BuildCmd    []string
	RunCmd      []string
	WorkingDir  string
	Env         []string
}

type ServiceManager struct {
	services     map[string]*Service
	serviceOrder []string // Maintains the order of services
	mu           sync.RWMutex
}

func NewServiceManager() *ServiceManager {
	// Get the directory where the binary is located
	execPath, err := os.Executable()
	var baseDir string
	if err == nil {
		baseDir = filepath.Dir(execPath)
		// If running from nonio-tui directory, go up one level
		if filepath.Base(baseDir) == "nonio-tui" {
			baseDir = filepath.Dir(baseDir)
		}
	} else {
		// Fallback: assume we're in nonio root or nonio-tui
		wd, _ := os.Getwd()
		if filepath.Base(wd) == "nonio-tui" {
			baseDir = filepath.Dir(wd)
		} else {
			baseDir = wd
		}
	}

	sm := &ServiceManager{
		services:     make(map[string]*Service),
		serviceOrder: []string{"frontend", "backend", "image-cdn", "video-cdn", "avatar-cdn"},
	}

	// Frontend service (first in order)
	frontendService := &Service{
		Name:       "soci-frontend",
		Port:       "4200",
		Status:     StatusStopped,
		WorkingDir: filepath.Join(baseDir, "soci-frontend"),
		RunCmd:     []string{"npm", "start"},
		BuildCmd:   []string{"npm", "run", "build"},
		HealthCheck: func() bool {
			return checkPort("4200")
		},
	}
	sm.services["frontend"] = frontendService

	// Backend service (second in order)
	backendDist := filepath.Join(baseDir, "soci-backend", "dist", "socid")
	backendService := &Service{
		Name:       "soci-backend",
		Port:       "4201",
		Status:     StatusStopped,
		WorkingDir: filepath.Join(baseDir, "soci-backend"),
		BuildCmd:   []string{"go", "build", "-o", backendDist, "./cmd"},
		RunCmd:     []string{backendDist},
		Env:        getBackendEnv(),
		HealthCheck: func() bool {
			return checkPort("4201")
		},
	}
	sm.services["backend"] = backendService

	// Image CDN (third in order)
	imageCdnService := &Service{
		Name:       "soci-image-cdn",
		Port:       "4203",
		Status:     StatusStopped,
		WorkingDir: filepath.Join(baseDir, "soci-image-cdn"),
		BuildCmd:   []string{"go", "build", "-o", "image-cdn", "main.go"},
		RunCmd:     []string{filepath.Join(baseDir, "soci-image-cdn", "image-cdn")},
		HealthCheck: func() bool {
			return checkPort("4203")
		},
	}
	sm.services["image-cdn"] = imageCdnService

	// Video CDN (fourth in order)
	videoCdnService := &Service{
		Name:       "soci-video-cdn",
		Port:       "4204",
		Status:     StatusStopped,
		WorkingDir: filepath.Join(baseDir, "soci-video-cdn"),
		BuildCmd:   []string{"go", "build", "-o", "video-cdn", "main.go"},
		RunCmd:     []string{filepath.Join(baseDir, "soci-video-cdn", "video-cdn")},
		HealthCheck: func() bool {
			return checkPort("4204")
		},
	}
	sm.services["video-cdn"] = videoCdnService

	// Avatar CDN (fifth in order)
	avatarCdnService := &Service{
		Name:       "soci-avatar-cdn",
		Port:       "4202",
		Status:     StatusStopped,
		WorkingDir: filepath.Join(baseDir, "soci-avatar-cdn"),
		BuildCmd:   []string{"go", "build", "-o", "avatar-cdn", "main.go"},
		RunCmd:     []string{filepath.Join(baseDir, "soci-avatar-cdn", "avatar-cdn")},
		HealthCheck: func() bool {
			return checkPort("4202")
		},
	}
	sm.services["avatar-cdn"] = avatarCdnService

	return sm
}

func getBackendEnv() []string {
	env := os.Environ()
	backendEnv := []string{
		"APP_KEY=asdfa323faefjifajwiefawef",
		"WEB_HOST=http://localhost:4200",
		"DB_HOST=127.0.0.1",
		"DB_PORT=3306",
		"DB_DATABASE=socidb",
		"DB_USER=dbuser",
		"DB_PASSWORD=password",
		"APP_PORT=4201",
		"ADMIN_EMAIL=test@example.com",
		"ADMIN_EMAIL_PASSWORD=password",
		"EMAIL_ACCESS_TOKEN=",
		"EMAIL_REFRESH_TOKEN=",
		"EMAIL_CLIENT_ID=",
		"EMAIL_CLIENT_SECRET=",
		"STRIPE_KEY=",
		"WEBHOOK_ENDPOINT_SECRET=",
		"STRIPE_SECRET_KEY=sk_test_dummy",
		"STRIPE_PUBLISHABLE_KEY=pk_test_dummy",
	}

	// Merge with existing env
	for _, e := range backendEnv {
		env = append(env, e)
	}
	return env
}

func (sm *ServiceManager) GetService(name string) *Service {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.services[name]
}

func (sm *ServiceManager) GetAllServices() []*Service {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	services := make([]*Service, 0, len(sm.serviceOrder))
	for _, name := range sm.serviceOrder {
		if service, ok := sm.services[name]; ok {
			services = append(services, service)
		}
	}
	return services
}

func (sm *ServiceManager) GetServiceKeyByIndex(index int) string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	if index >= 0 && index < len(sm.serviceOrder) {
		return sm.serviceOrder[index]
	}
	return ""
}

func (sm *ServiceManager) StartAllServices() {
	// Start all services in order
	delay := 0
	for _, key := range sm.serviceOrder {
		sm.mu.RLock()
		service, ok := sm.services[key]
		sm.mu.RUnlock()

		if !ok {
			continue
		}

		// Start services if they're not already running
		sm.mu.RLock()
		status := service.Status
		sm.mu.RUnlock()

		if status == StatusStopped || status == StatusError {
			serviceKey := key
			serviceDelay := delay
			go func() {
				time.Sleep(time.Duration(serviceDelay) * time.Millisecond)
				sm.StartService(serviceKey)
			}()
			// Increase delay for next service (stagger the starts)
			delay += 200
		}
	}
}

func (sm *ServiceManager) StartService(name string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	service, ok := sm.services[name]
	if !ok {
		return fmt.Errorf("service %s not found", name)
	}

	if service.Status == StatusRunning || service.Status == StatusStarting {
		return fmt.Errorf("service %s is already running or starting", name)
	}

	// Kill any process using the port before starting
	if service.Port != "" {
		if err := killProcessOnPort(service.Port); err != nil {
			// Log but don't fail - port might not be in use
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, fmt.Sprintf("[START] Note: %v", err))
			service.LogsMutex.Unlock()
		}
	}

	service.Status = StatusStarting
	service.LastError = ""
	service.StartTime = time.Now()

	// Build if needed
	if len(service.BuildCmd) > 0 {
		buildCtx, buildCancel := context.WithTimeout(context.Background(), 30*time.Second)
		buildCmd := exec.CommandContext(buildCtx, service.BuildCmd[0], service.BuildCmd[1:]...)
		buildCmd.Dir = service.WorkingDir
		if err := buildCmd.Run(); err != nil {
			buildCancel()
			service.Status = StatusError
			service.LastError = fmt.Sprintf("build failed: %v", err)
			return err
		}
		buildCancel()
	}

	// Run migrations for backend
	if name == "backend" {
		if err := sm.runBackendMigrations(service); err != nil {
			service.Status = StatusError
			service.LastError = fmt.Sprintf("migrations failed: %v", err)
			return err
		}
	}

	// Start the service
	ctx, cancel := context.WithCancel(context.Background())
	service.Cancel = cancel

	cmd := exec.CommandContext(ctx, service.RunCmd[0], service.RunCmd[1:]...)
	cmd.Dir = service.WorkingDir
	cmd.Env = service.Env

	// Capture stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		service.Status = StatusError
		service.LastError = fmt.Sprintf("failed to create stdout pipe: %v", err)
		return err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		service.Status = StatusError
		service.LastError = fmt.Sprintf("failed to create stderr pipe: %v", err)
		return err
	}

	service.Cmd = cmd

	// Start capturing logs
	go sm.captureLogs(service, stdout, stderr)

	if err := cmd.Start(); err != nil {
		cancel()
		service.Status = StatusError
		service.LastError = fmt.Sprintf("failed to start: %v", err)
		return err
	}

	// Wait a bit and check if process is still running
	go func() {
		// Give the service time to start up
		time.Sleep(2 * time.Second)

		sm.mu.Lock()
		// Check if we're still in starting state
		if service.Status == StatusStarting {
			// Check health if health check is available (most reliable way to verify service is up)
			healthOk := false
			if service.HealthCheck != nil {
				sm.mu.Unlock() // Unlock before health check (it might take time)
				healthOk = service.HealthCheck()
				sm.mu.Lock()
			} else {
				// No health check, just verify process exists
				healthOk = (cmd.Process != nil)
			}

			// If health check passes, mark as running
			if healthOk {
				service.Status = StatusRunning
			} else {
				// Health check failed or process doesn't exist
				service.Status = StatusError
				if service.LastError == "" {
					service.LastError = "health check failed or process not responding"
				}
			}
		}
		sm.mu.Unlock()

		// Monitor process - wait for it to finish
		err := cmd.Wait()
		sm.mu.Lock()
		// Only update status if we were running (not if we were stopped manually)
		if service.Status == StatusRunning {
			service.Status = StatusStopped
			if err != nil {
				service.LastError = fmt.Sprintf("process exited with error: %v", err)
				service.Status = StatusError
			}
		} else if service.Status == StatusStarting {
			// Process exited before we could mark it as running
			service.Status = StatusError
			if service.LastError == "" {
				service.LastError = "process exited unexpectedly"
			}
		}
		sm.mu.Unlock()
	}()

	return nil
}

func (sm *ServiceManager) runBackendMigrations(service *Service) error {
	// Add log entry for starting migrations
	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, "[MIGRATION] Starting database migrations...")
	service.LogsMutex.Unlock()

	// Check if goose is available
	goosePath, err := exec.LookPath("goose")
	if err != nil {
		// Try common locations
		goosePath = filepath.Join(os.Getenv("GOPATH"), "bin", "goose")
		if _, err := os.Stat(goosePath); err != nil {
			errorMsg := fmt.Sprintf("[MIGRATION] ERROR: goose not found in PATH or GOPATH/bin (%s)", goosePath)
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, errorMsg)
			service.LogsMutex.Unlock()
			return fmt.Errorf("goose not found, skipping migrations")
		}
	}

	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, fmt.Sprintf("[MIGRATION] Using goose at: %s", goosePath))
	service.LogsMutex.Unlock()

	migrationsDir := filepath.Join(service.WorkingDir, "migrations")
	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, fmt.Sprintf("[MIGRATION] Migrations directory: %s", migrationsDir))
	service.LogsMutex.Unlock()

	// Check if migrations directory exists
	if _, err := os.Stat(migrationsDir); err != nil {
		errorMsg := fmt.Sprintf("[MIGRATION] ERROR: Migrations directory does not exist: %s", migrationsDir)
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, errorMsg)
		service.LogsMutex.Unlock()
		return fmt.Errorf("migrations directory not found: %v", err)
	}

	// Build DSN
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbDatabase := os.Getenv("DB_DATABASE")

	if dbUser == "" {
		dbUser = "dbuser"
	}
	if dbPassword == "" {
		dbPassword = "password"
	}
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	if dbPort == "" {
		dbPort = "3306"
	}
	if dbDatabase == "" {
		dbDatabase = "socidb"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", dbUser, dbPassword, dbHost, dbPort, dbDatabase)

	// Log connection info (without password)
	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, fmt.Sprintf("[MIGRATION] Connecting to database: %s@tcp(%s:%s)/%s", dbUser, dbHost, dbPort, dbDatabase))
	service.LogsMutex.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, goosePath, "mysql", dsn, "up")
	cmd.Dir = migrationsDir

	// Capture stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("[MIGRATION] ERROR: Failed to create stdout pipe: %v", err)
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, errorMsg)
		service.LogsMutex.Unlock()
		return fmt.Errorf("failed to create stdout pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errorMsg := fmt.Sprintf("[MIGRATION] ERROR: Failed to create stderr pipe: %v", err)
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, errorMsg)
		service.LogsMutex.Unlock()
		return fmt.Errorf("failed to create stderr pipe: %v", err)
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		errorMsg := fmt.Sprintf("[MIGRATION] ERROR: Failed to start goose command: %v", err)
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, errorMsg)
		service.LogsMutex.Unlock()
		return fmt.Errorf("failed to start migration: %v", err)
	}

	// Capture output in real-time
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, fmt.Sprintf("[MIGRATION] %s", line))
			if len(service.Logs) > 100 {
				service.Logs = service.Logs[1:]
			}
			service.LogsMutex.Unlock()
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, fmt.Sprintf("[MIGRATION] ERROR: %s", line))
			if len(service.Logs) > 100 {
				service.Logs = service.Logs[1:]
			}
			service.LogsMutex.Unlock()
		}
	}()

	// Wait for command to complete
	if err := cmd.Wait(); err != nil {
		errorMsg := fmt.Sprintf("[MIGRATION] ERROR: Migration command failed: %v", err)
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, errorMsg)
		service.LogsMutex.Unlock()
		return fmt.Errorf("migration error: %v", err)
	}

	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, "[MIGRATION] Migrations completed successfully")
	service.LogsMutex.Unlock()

	return nil
}

func (sm *ServiceManager) captureLogs(service *Service, stdout, stderr io.ReadCloser) {
	scannerOut := bufio.NewScanner(stdout)
	scannerErr := bufio.NewScanner(stderr)

	go func() {
		for scannerOut.Scan() {
			line := scannerOut.Text()
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, line)
			if len(service.Logs) > 100 {
				service.Logs = service.Logs[1:]
			}
			service.LogsMutex.Unlock()
		}
	}()

	go func() {
		for scannerErr.Scan() {
			line := scannerErr.Text()
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, "[ERROR] "+line)
			if len(service.Logs) > 100 {
				service.Logs = service.Logs[1:]
			}
			service.LogsMutex.Unlock()
		}
	}()
}

func (sm *ServiceManager) StopService(name string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	service, ok := sm.services[name]
	if !ok {
		return fmt.Errorf("service %s not found", name)
	}

	if service.Cancel != nil {
		service.Cancel()
	}

	if service.Cmd != nil && service.Cmd.Process != nil {
		service.Cmd.Process.Kill()
	}

	service.Status = StatusStopped
	return nil
}

func (sm *ServiceManager) StopAllServices() {
	// Stop all services in reverse order
	for i := len(sm.serviceOrder) - 1; i >= 0; i-- {
		key := sm.serviceOrder[i]
		sm.mu.RLock()
		service, ok := sm.services[key]
		sm.mu.RUnlock()

		if !ok {
			continue
		}

		// Stop service if it's running
		sm.mu.RLock()
		status := service.Status
		sm.mu.RUnlock()

		if status == StatusRunning || status == StatusStarting {
			sm.StopService(key)
		}
	}
}

func (sm *ServiceManager) RebuildAndRestartService(name string) error {
	sm.mu.Lock()
	service, ok := sm.services[name]
	if !ok {
		sm.mu.Unlock()
		return fmt.Errorf("service %s not found", name)
	}
	
	// Check if service is running and stop it
	wasRunning := (service.Status == StatusRunning || service.Status == StatusStarting)
	sm.mu.Unlock()
	
	if wasRunning {
		// Stop the service first
		if err := sm.StopService(name); err != nil {
			return fmt.Errorf("failed to stop service: %v", err)
		}
		// Wait a bit for the service to fully stop
		time.Sleep(500 * time.Millisecond)
	}
	
	sm.mu.Lock()
	service = sm.services[name] // Re-fetch after unlock
	sm.mu.Unlock()
	
	// Add log entry
	service.LogsMutex.Lock()
	service.Logs = append(service.Logs, "[REBUILD] Rebuilding service...")
	service.LogsMutex.Unlock()
	
	// Run build command if it exists
	if len(service.BuildCmd) > 0 {
		buildCtx, buildCancel := context.WithTimeout(context.Background(), 2*time.Minute)
		buildCmd := exec.CommandContext(buildCtx, service.BuildCmd[0], service.BuildCmd[1:]...)
		buildCmd.Dir = service.WorkingDir
		buildCmd.Env = service.Env
		
		// Capture build output
		buildOutput, err := buildCmd.CombinedOutput()
		buildCancel()
		
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, fmt.Sprintf("[REBUILD] Build output:\n%s", string(buildOutput)))
		service.LogsMutex.Unlock()
		
		if err != nil {
			service.LogsMutex.Lock()
			service.Logs = append(service.Logs, fmt.Sprintf("[REBUILD] Build failed: %v", err))
			service.LogsMutex.Unlock()
			return fmt.Errorf("build failed: %v", err)
		}
		
		service.LogsMutex.Lock()
		service.Logs = append(service.Logs, "[REBUILD] Build completed successfully")
		service.LogsMutex.Unlock()
	}
	
	// Start the service
	return sm.StartService(name)
}

func (sm *ServiceManager) RebuildAndRestartAllServices() {
	// Rebuild and restart all services in order
	for _, key := range sm.serviceOrder {
		// Rebuild and restart in a goroutine with a small delay
		go func(serviceKey string) {
			time.Sleep(200 * time.Millisecond) // Small stagger
			sm.RebuildAndRestartService(serviceKey)
		}(key)
	}
}

func checkPort(port string) bool {
	conn, err := net.DialTimeout("tcp", "localhost:"+port, 1*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func killProcessOnPort(port string) error {
	// Use lsof to find the process using the port
	cmd := exec.Command("lsof", "-ti", fmt.Sprintf(":%s", port))
	output, err := cmd.Output()
	if err != nil {
		// Port might not be in use, which is fine
		return nil
	}

	// Parse the PID(s) from output
	pidStr := string(output)
	if pidStr == "" {
		return nil
	}

	// lsof can return multiple PIDs, kill them all
	pids := strings.Fields(pidStr)
	for _, pid := range pids {
		if pid == "" {
			continue
		}
		// Kill the process
		killCmd := exec.Command("kill", "-9", pid)
		if err := killCmd.Run(); err != nil {
			return fmt.Errorf("failed to kill process %s on port %s: %v", pid, port, err)
		}
	}

	return nil
}
