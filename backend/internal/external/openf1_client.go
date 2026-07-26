package external

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"banker_lapp_backend/internal/domain"
)

type OpenF1Client struct {
	baseURL string
	client  *http.Client
}

func NewOpenF1Client() *OpenF1Client {
	return &OpenF1Client{
		baseURL: "https://api.openf1.org/v1",
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// openF1Session mirrors the fields we use from the OpenF1 /sessions endpoint.
type openF1Session struct {
	SessionKey       int    `json:"session_key"`
	SessionName      string `json:"session_name"`
	SessionType      string `json:"session_type"`
	DateStart        string `json:"date_start"`
	MeetingKey       int    `json:"meeting_key"`
	CircuitShortName string `json:"circuit_short_name"`
	CountryName      string `json:"country_name"`
	Location         string `json:"location"`
	Year             int    `json:"year"`
	IsCancelled      bool   `json:"is_cancelled"`
}

// openF1Driver mirrors the fields we use from the OpenF1 /drivers endpoint.
type openF1Driver struct {
	DriverNumber int    `json:"driver_number"`
	NameAcronym  string `json:"name_acronym"`
	FullName     string `json:"full_name"`
	TeamName     string `json:"team_name"`
	TeamColour   string `json:"team_colour"`
}

func (c *OpenF1Client) getJSON(ctx context.Context, url string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("openf1: unexpected status %d for %s", resp.StatusCode, url)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// FetchRaceWeekends builds one domain.Race per Grand Prix weekend for the given
// season by grouping OpenF1 sessions on meeting_key. FP1/Qualifying/Race times
// come from the matching sessions. Meetings without a Race session are skipped.
func (c *OpenF1Client) FetchRaceWeekends(ctx context.Context, season int) ([]domain.Race, error) {
	var sessions []openF1Session
	url := fmt.Sprintf("%s/sessions?year=%d", c.baseURL, season)
	if err := c.getJSON(ctx, url, &sessions); err != nil {
		return nil, err
	}

	type weekend struct {
		meetingKey  int
		gp          string
		circuit     string
		country     string
		fp1         time.Time
		qualifying  time.Time
		race        time.Time
		hasRace     bool
		hasFP1      bool
		hasQualify  bool
	}

	weekends := map[int]*weekend{}
	order := []int{}

	for _, s := range sessions {
		if s.IsCancelled || s.Year != season {
			continue
		}
		w, ok := weekends[s.MeetingKey]
		if !ok {
			w = &weekend{meetingKey: s.MeetingKey, circuit: s.CircuitShortName, country: s.CountryName, gp: s.Location}
			weekends[s.MeetingKey] = w
			order = append(order, s.MeetingKey)
		}

		start := parseOpenF1Time(s.DateStart)
		switch s.SessionName {
		case "Practice 1":
			w.fp1, w.hasFP1 = start, true
		case "Qualifying":
			w.qualifying, w.hasQualify = start, true
		case "Race":
			w.race, w.hasRace = start, true
		}
	}

	races := make([]domain.Race, 0, len(order))
	now := time.Now()
	for _, mk := range order {
		w := weekends[mk]
		if !w.hasRace {
			continue // only track full Grand Prix weekends
		}
		// Predictions lock at FP1; fall back to race day if FP1 is missing.
		fp1 := w.fp1
		if !w.hasFP1 {
			fp1 = w.race
		}
		qualifying := w.qualifying
		if !w.hasQualify {
			qualifying = w.race
		}

		// Status here is purely the prediction window. "completed" is reserved
		// for races that have official results (set by an admin) and is applied
		// separately, so a schedule re-sync never strands entered results.
		status := "upcoming"
		switch {
		case now.After(fp1):
			status = "locked"
		case now.After(fp1.Add(-7 * 24 * time.Hour)):
			status = "open"
		}

		races = append(races, domain.Race{
			APIRaceID:      fmt.Sprintf("openf1-%d-%d", season, mk),
			GrandPrix:      fmt.Sprintf("%s Grand Prix", w.gp),
			CircuitName:    w.circuit,
			Country:        w.country,
			FP1Time:        fp1,
			QualifyingTime: qualifying,
			RaceTime:       w.race,
			Season:         season,
			Status:         status,
		})
	}

	sort.Slice(races, func(i, j int) bool { return races[i].RaceTime.Before(races[j].RaceTime) })
	return races, nil
}

// FetchLatestDrivers returns the current F1 grid using name acronyms (VER, NOR,
// ...) as the stable driver id shared by predictions and results.
func (c *OpenF1Client) FetchLatestDrivers(ctx context.Context) ([]domain.Driver, error) {
	var raw []openF1Driver
	url := fmt.Sprintf("%s/drivers?session_key=latest", c.baseURL)
	if err := c.getJSON(ctx, url, &raw); err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	drivers := make([]domain.Driver, 0, len(raw))
	for _, d := range raw {
		id := d.NameAcronym
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		drivers = append(drivers, domain.Driver{
			DriverID:      id,
			BroadcastName: d.FullName,
			TeamName:      d.TeamName,
			TeamColor:     d.TeamColour,
		})
	}
	sort.Slice(drivers, func(i, j int) bool { return drivers[i].BroadcastName < drivers[j].BroadcastName })
	return drivers, nil
}

func parseOpenF1Time(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return time.Time{}
}
