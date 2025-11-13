package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/lipgloss/table"
)

type model struct {
	services   *ServiceManager
	cursor     int
	lastUpdate time.Time
	width      int
	height     int
}

type tickMsg time.Time

func initialModel() model {
	sm := NewServiceManager()
	return model{
		services:   sm,
		cursor:     0,
		lastUpdate: time.Now(),
	}
}

func (m model) Init() tea.Cmd {
	// Start all services automatically
	go func() {
		time.Sleep(500 * time.Millisecond) // Small delay to let UI initialize
		m.services.StartAllServices()
	}()

	return tea.Batch(
		tick(),
		checkHealth(),
	)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			services := m.services.GetAllServices()
			if m.cursor < len(services)-1 {
				m.cursor++
			}

		case "enter", " ":
			services := m.services.GetAllServices()
			if m.cursor < len(services) {
				serviceKey := m.services.GetServiceKeyByIndex(m.cursor)
				if serviceKey != "" {
					service := services[m.cursor]
					if service.Status == StatusStopped || service.Status == StatusError {
						go m.services.StartService(serviceKey)
					} else if service.Status == StatusRunning || service.Status == StatusStarting {
						go m.services.StopService(serviceKey)
					}
					// Return a command to refresh the UI
					return m, tea.Batch(tick(), checkHealth())
				}
			}

		case "r":
			// Rebuild and restart selected service
			services := m.services.GetAllServices()
			if m.cursor < len(services) {
				serviceKey := m.services.GetServiceKeyByIndex(m.cursor)
				if serviceKey != "" {
					go m.services.RebuildAndRestartService(serviceKey)
					return m, tea.Batch(tick(), checkHealth())
				}
			}

		case "R":
			// Rebuild and restart all services
			go m.services.RebuildAndRestartAllServices()
			return m, tea.Batch(tick(), checkHealth())
		}

	case tickMsg:
		m.lastUpdate = time.Time(msg)
		return m, tea.Batch(
			tick(),
			checkHealth(),
		)

	case healthCheckMsg:
		return m, nil
	}

	return m, nil
}

func (m model) View() string {
	if m.width == 0 {
		return "Initializing..."
	}

	var s strings.Builder

	// Calculate available space - fixed heights
	// Count actual lines:
	// Header: 3 lines (top border, title, bottom border)
	// Services table: 9 lines (top border, header, separator, 5 rows, bottom border)
	// Error line: 1 line
	// Controls: 1 line
	// Padding/newlines: 2 lines
	// Additional adjustment: -2 to prevent header cutoff
	headerHeight := 2
	servicesHeight := 8    // lipgloss table: border + header + separator + 5 rows + border
	serviceInfoHeight := 1 // Error line only (uptime moved to table)
	controlsHeight := 1
	padding := 0
	availableHeight := m.height - headerHeight - servicesHeight - serviceInfoHeight - controlsHeight - padding - 2

	// Ensure we don't have negative height
	if availableHeight < 3 {
		availableHeight = 3
	}

	// Full-width header - using lipgloss table
	headerTable := table.New().
		Border(lipgloss.RoundedBorder()).
		BorderStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("99"))).
		Width(m.width - 2).
		StyleFunc(func(row, col int) lipgloss.Style {
			// Header row - bold text
			return lipgloss.NewStyle().
				Foreground(lipgloss.Color("212")).
				Bold(true).
				Align(lipgloss.Center)
		}).
		Rows([]string{"Nonio Microservices Manager"}) // Empty row to make it a proper table

	s.WriteString(headerTable.Render() + "\n")

	// Service list - using lipgloss table
	services := m.services.GetAllServices()

	// Define beautiful styles
	headerStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8fcafa")).
		Bold(true).
		Align(lipgloss.Center)

	selectedRowStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("9")).
		Bold(true)

	// Build table rows - use raw text, apply styles via StyleFunc to avoid width calculation issues
	rows := [][]string{}
	for _, service := range services {
		// Use raw service name - styling will be applied via StyleFunc
		serviceName := service.Name

		// Status with emoji prefix (raw text)
		statusPrefix := ""
		statusText := string(service.Status)
		switch service.Status {
		case StatusRunning:
			statusPrefix = "✓ "
		case StatusError:
			statusPrefix = "✗ "
		case StatusStarting:
			statusPrefix = "⟳ "
		default:
			statusPrefix = "○ "
		}
		statusStr := " " + statusPrefix + statusText

		// Health check (raw text)
		health := "✗"
		if service.HealthCheck != nil {
			if service.HealthCheck() {
				health = "✓"
			}
		}

		port := service.Port
		if port == "" {
			port = "-"
		}

		// Calculate uptime (raw text)
		uptimeStr := "-"
		if service.Status == StatusRunning && !service.StartTime.IsZero() {
			uptime := time.Since(service.StartTime)
			uptimeStr = formatDuration(uptime)
		} else if service.Status == StatusStarting {
			uptimeStr = "starting"
		}

		rows = append(rows, []string{
			serviceName,
			statusStr,
			port,
			health,
			uptimeStr,
		})
	}

	// Create and style the table
	// Set width to terminal width - lipgloss handles ANSI code width calculation correctly
	t := table.New().
		Border(lipgloss.RoundedBorder()).
		BorderStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("#8fcafa"))).
		Width(m.width-2).
		Headers("Service", "Status", "Port", "Health", "Uptime").
		StyleFunc(func(row, col int) lipgloss.Style {
			// Row 0 is the header row
			if row == 0 {
				return headerStyle
			}

			// Apply row-specific styling
			rowIndex := row - 1 // Adjust for header row
			if rowIndex < len(services) {
				service := services[rowIndex]

				// Selected row styling
				if rowIndex == m.cursor {
					selectedStyle := lipgloss.NewStyle().
						Foreground(lipgloss.Color("86")).
						Bold(true).
						PaddingLeft(1)
					return selectedStyle
				}

				// Column-specific styling
				switch col {
				case 1: // Status column
					switch service.Status {
					case StatusRunning:
						return lipgloss.NewStyle().Foreground(lipgloss.Color("42")).Bold(true).PaddingLeft(1)
					case StatusError:
						return lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true).PaddingLeft(1)
					case StatusStarting:
						return lipgloss.NewStyle().Foreground(lipgloss.Color("226")).Bold(true).PaddingLeft(1)
					default:
						return lipgloss.NewStyle().Foreground(lipgloss.Color("240")).PaddingLeft(1)
					}
				case 2: // Port column
					if rowIndex == m.cursor {
						return selectedRowStyle.PaddingLeft(1)
					}
					// White for unselected
					return lipgloss.NewStyle().Foreground(lipgloss.Color("15")).PaddingLeft(1)
				case 3: // Health column
					healthColor := "196" // red
					if service.HealthCheck != nil && service.HealthCheck() {
						healthColor = "42" // green
					}
					return lipgloss.NewStyle().Foreground(lipgloss.Color(healthColor)).Bold(true).PaddingLeft(1)
				case 4: // Uptime column
					if rowIndex == m.cursor {
						return selectedRowStyle.PaddingLeft(1)
					}
					// White for unselected
					return lipgloss.NewStyle().Foreground(lipgloss.Color("15")).PaddingLeft(1)
				case 0: // Service name column
					if rowIndex == m.cursor {
						return selectedRowStyle.PaddingLeft(1)
					}
					return lipgloss.NewStyle().PaddingLeft(1)
				}
			}

			return lipgloss.NewStyle().PaddingLeft(1)
		}).
		Rows(rows...)

	s.WriteString(t.Render() + "\n")

	// Selected service details
	if m.cursor < len(services) {
		service := services[m.cursor]

		if service.LastError != "" {
			errorStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true)
			s.WriteString(errorStyle.Render("Error: "+service.LastError) + "\n")
		}

		// Log area - using lipgloss table
		service.LogsMutex.Lock()
		logLines := service.Logs
		service.LogsMutex.Unlock()

		// Calculate how many log lines we can fit
		// Table has: top border (1) + header (1) + separator (1) + rows + bottom border (1)
		// So we need: availableHeight - 4 for the log rows
		maxLogRows := availableHeight - 4
		if maxLogRows < 1 {
			maxLogRows = 1
		}

		// Show most recent logs that fit
		if len(logLines) > maxLogRows {
			logLines = logLines[len(logLines)-maxLogRows:]
		}

		// Build log table rows
		logRows := [][]string{}
		for _, log := range logLines {
			// Extract message from structured log format if it matches
			logText := extractLogMessage(log)

			// Truncate if too long (leave room for table borders and padding)
			maxLogWidth := m.width - 6 // account for borders and padding
			if len(logText) > maxLogWidth {
				logText = logText[:maxLogWidth-3] + "..."
			}
			logRows = append(logRows, []string{logText})
		}

		// Fill remaining space with empty rows
		for len(logRows) < maxLogRows {
			logRows = append(logRows, []string{""})
		}

		// Create log table
		logTableStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color("99"))

		logTable := table.New().
			Border(lipgloss.RoundedBorder()).
			BorderStyle(logTableStyle).
			Width(m.width - 2).
			Headers("Logs").
			StyleFunc(func(row, col int) lipgloss.Style {
				if row == 0 {
					// Header style
					return lipgloss.NewStyle().
						Foreground(lipgloss.Color("212")).
						Bold(true).
						Align(lipgloss.Center)
				}
				// Log line style - use a subtle color
				return lipgloss.NewStyle().
					Foreground(lipgloss.Color("252")).
					PaddingLeft(1)
			}).
			Rows(logRows...)

		s.WriteString(logTable.Render() + "\n")
	} else {
		// No service selected, show empty log table
		emptyRows := [][]string{}
		for i := 0; i < availableHeight-4; i++ {
			emptyRows = append(emptyRows, []string{""})
		}

		logTableStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color("99"))

		logTable := table.New().
			Border(lipgloss.RoundedBorder()).
			BorderStyle(logTableStyle).
			Width(m.width - 2).
			Headers("Logs").
			StyleFunc(func(row, col int) lipgloss.Style {
				if row == 0 {
					return lipgloss.NewStyle().
						Foreground(lipgloss.Color("#8fcafa")).
						Bold(true).
						Align(lipgloss.Center)
				}
				return lipgloss.NewStyle()
			}).
			Rows(emptyRows...)

		s.WriteString(logTable.Render() + "\n")
	}

	// Controls at the bottom (grey color)
	controls := " ↑/↓ Navigate | Enter/Space Toggle | r Rebuild Selected | R Rebuild All | q Quit"
	controlsStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Faint(true)
	controlsPadding := m.width - len(controls) - 1
	if controlsPadding < 0 {
		controlsPadding = 0
	}
	s.WriteString(controlsStyle.Render(controls+strings.Repeat(" ", controlsPadding)) + "\n")

	return s.String()
}

func extractLogMessage(logLine string) string {
	// Match structured log format: time="..." level=... msg="..."
	// Pattern: msg="MESSAGE" (with optional quotes)
	msgRegex := regexp.MustCompile(`msg="([^"]+)"|msg=([^\s]+)`)
	matches := msgRegex.FindStringSubmatch(logLine)
	if len(matches) > 0 {
		// Return the captured message (first capture group if quoted, second if unquoted)
		if matches[1] != "" {
			return matches[1]
		}
		if matches[2] != "" {
			return matches[2]
		}
	}
	// If no match, return original log line
	return logLine
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm %ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
}

func tick() tea.Cmd {
	return tea.Tick(1*time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

type healthCheckMsg struct{}

func checkHealth() tea.Cmd {
	return tea.Tick(5*time.Second, func(t time.Time) tea.Msg {
		return healthCheckMsg{}
	})
}

func main() {
	m := initialModel()
	p := tea.NewProgram(m, tea.WithAltScreen())

	// Ensure services are stopped when program exits (handles Ctrl+C, errors, etc.)
	defer func() {
		m.services.StopAllServices()
	}()

	finalModel, err := p.Run()
	if err != nil {
		fmt.Printf("Alas, there's been an error: %v", err)
		os.Exit(1)
	}

	// Stop all services before exiting (handles normal quit)
	if finalM, ok := finalModel.(model); ok {
		finalM.services.StopAllServices()
	} else {
		// Fallback to initial model's service manager
		m.services.StopAllServices()
	}
}
