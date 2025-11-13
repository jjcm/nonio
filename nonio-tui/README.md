# Nonio TUI - Microservices Manager

A Terminal User Interface (TUI) built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) to launch and monitor all Nonio microservices.

## Features

- **Service Management**: Start and stop all microservices from one interface
- **Health Monitoring**: Real-time health checks for:
  - MariaDB database connection
  - All HTTP services (backend, frontend, CDNs)
- **Log Viewing**: View recent logs from each service
- **Status Display**: See the current status of each service (stopped, starting, running, error)

## Services Monitored

1. **MariaDB** (Port 3306) - Database connection monitoring
2. **soci-backend** (Port 4201) - Primary backend API
3. **soci-frontend** (Port 4200) - Frontend web server
4. **soci-avatar-cdn** (Port 4202) - Avatar CDN and encoding
5. **soci-image-cdn** (Port 4203) - Image CDN and encoding
6. **soci-video-cdn** (Port 4204) - Video CDN and encoding

## Building

```bash
cd nonio-tui
go mod download
go build -o nonio-tui
```

## Running

From the `nonio` project root:

```bash
./nonio-tui/nonio-tui
```

Or from the `nonio-tui` directory:

```bash
cd nonio-tui
./nonio-tui
```

## Controls

- **↑/↓ or k/j**: Navigate between services
- **Enter/Space**: Start or stop the selected service
- **l**: View logs for the selected service
- **q**: Quit the application

## Configuration

The TUI uses environment variables for database configuration. If not set, it defaults to:
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_USER=dbuser`
- `DB_PASSWORD=password`
- `DB_DATABASE=socidb`

For the backend service, it uses the same environment variables as defined in `soci-backend/localRun.sh`.

## Requirements

- Go 1.21 or later
- MariaDB/MySQL running (for database monitoring)
- `goose` migration tool (for backend migrations)
- `npm` (for frontend service)
- All service dependencies installed

## Notes

- The backend service will automatically run migrations before starting
- Services are built automatically when started (if build commands are defined)
- Logs are limited to the last 100 lines per service
- Health checks run every 5 seconds

