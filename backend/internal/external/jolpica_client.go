package external

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"banker_lapp_backend/internal/domain"
)

// F1Client talks to the Jolpica F1 API (https://api.jolpi.ca), the community
// maintained successor to Ergast.
//
// This replaced the OpenF1 client. OpenF1 moved current-season data behind paid
// sponsorship: requests for the running season return 401, while older seasons
// still work unauthenticated. Jolpica covers the calendar, the driver grid,
// and — once a session has finished — its official classification, all with
// no account, token or cost. It is not a live-timing feed: qualifying and race
// classifications only appear here after Jolpica has ingested them, typically
// shortly after the chequered flag, which is what the results poller
// (AdminService.PollQualifyingResults / PollRaceResults) is polling for.
type F1Client struct {
	baseURL string
	client  *http.Client
}

func NewF1Client() *F1Client {
	return &F1Client{
		baseURL: "https://api.jolpi.ca/ergast/f1",
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// --- Wire types. Ergast nests everything under MRData and returns all scalars
// as strings, hence the string fields and explicit parsing below. ---

type ergastEvent struct {
	Date string `json:"date"`
	Time string `json:"time"`
}

type ergastRace struct {
	Season  string `json:"season"`
	Round   string `json:"round"`
	RaceName string `json:"raceName"`
	Date    string `json:"date"`
	Time    string `json:"time"`
	Circuit struct {
		CircuitName string `json:"circuitName"`
		Location    struct {
			Locality string `json:"locality"`
			Country  string `json:"country"`
		} `json:"Location"`
	} `json:"Circuit"`
	FirstPractice  *ergastEvent `json:"FirstPractice"`
	SecondPractice *ergastEvent `json:"SecondPractice"`
	ThirdPractice  *ergastEvent `json:"ThirdPractice"`
	Qualifying     *ergastEvent `json:"Qualifying"`
	// Sprint weekends replace FP2/FP3; sprint qualifying can precede FP1 in
	// wall-clock terms, but FP1 is still the first on-track session.
	SprintQualifying *ergastEvent `json:"SprintQualifying"`
	Sprint           *ergastEvent `json:"Sprint"`
}

type ergastRacesResponse struct {
	MRData struct {
		RaceTable struct {
			Races []ergastRace `json:"Races"`
		} `json:"RaceTable"`
	} `json:"MRData"`
}

type ergastDriver struct {
	DriverID   string `json:"driverId"`
	Code       string `json:"code"`
	GivenName  string `json:"givenName"`
	FamilyName string `json:"familyName"`
}

type ergastConstructor struct {
	ConstructorID string `json:"constructorId"`
	Name          string `json:"name"`
}

type ergastStandingsResponse struct {
	MRData struct {
		StandingsTable struct {
			StandingsLists []struct {
				DriverStandings []struct {
					Position     string              `json:"position"`
					Points       string              `json:"points"`
					Wins         string              `json:"wins"`
					Driver       ergastDriver        `json:"Driver"`
					Constructors []ergastConstructor `json:"Constructors"`
				} `json:"DriverStandings"`
			} `json:"StandingsLists"`
		} `json:"StandingsTable"`
	} `json:"MRData"`
}

type ergastDriversResponse struct {
	MRData struct {
		DriverTable struct {
			Drivers []ergastDriver `json:"Drivers"`
		} `json:"DriverTable"`
	} `json:"MRData"`
}

type ergastQualifyingResponse struct {
	MRData struct {
		RaceTable struct {
			Races []struct {
				QualifyingResults []struct {
					Position string       `json:"position"`
					Driver   ergastDriver `json:"Driver"`
				} `json:"QualifyingResults"`
			} `json:"Races"`
		} `json:"RaceTable"`
	} `json:"MRData"`
}

type ergastResultsResponse struct {
	MRData struct {
		RaceTable struct {
			Races []struct {
				Results []struct {
					Position string       `json:"position"`
					Driver   ergastDriver `json:"Driver"`
				} `json:"Results"`
			} `json:"Races"`
		} `json:"RaceTable"`
	} `json:"MRData"`
}

// teamColors keeps the accent colour the UI used to get from OpenF1's
// team_colour field, which Ergast does not provide. Keyed by constructorId.
var teamColors = map[string]string{
	"mercedes":     "27F4D2",
	"ferrari":      "E8002D",
	"red_bull":     "3671C6",
	"mclaren":      "FF8000",
	"aston_martin": "229971",
	"alpine":       "FF87BC",
	"williams":     "64C4FF",
	"rb":           "6692FF",
	"sauber":       "52E252",
	"audi":         "52E252",
	"haas":         "B6BABD",
	"cadillac":     "C6A96C",
}

func (c *F1Client) getJSON(ctx context.Context, url string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jolpica: unexpected status %d for %s", resp.StatusCode, url)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// FetchRaceWeekends returns one domain.Race per Grand Prix for the season.
//
// Ergast already models a weekend as a single race object with its session
// times attached, so unlike OpenF1 there is no grouping by meeting key.
func (c *F1Client) FetchRaceWeekends(ctx context.Context, season int) ([]domain.Race, error) {
	var out ergastRacesResponse
	url := fmt.Sprintf("%s/%d/races/?format=json&limit=100", c.baseURL, season)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return nil, err
	}

	raw := out.MRData.RaceTable.Races
	races := make([]domain.Race, 0, len(raw))
	now := time.Now()

	for _, r := range raw {
		raceTime := parseErgastTime(r.Date, r.Time)
		if raceTime.IsZero() {
			continue // no usable race time; nothing to schedule or lock against
		}

		// Predictions lock at FP1. Fall back to sprint qualifying, then to race
		// day, so a weekend with an unusual format still locks at something
		// sensible rather than never locking.
		fp1 := eventTime(r.FirstPractice)
		if fp1.IsZero() {
			fp1 = eventTime(r.SprintQualifying)
		}
		if fp1.IsZero() {
			fp1 = raceTime
		}

		qualifying := eventTime(r.Qualifying)
		if qualifying.IsZero() {
			qualifying = raceTime
		}

		// Seed a status for the row. This is only a snapshot — every read
		// recomputes it via domain.DeriveSeasonStatuses, which also accounts for
		// when the previous race finished. "completed" is applied separately
		// when an admin enters results, so a re-sync never strands them.
		status := domain.StatusUpcoming
		if now.After(fp1) {
			status = domain.StatusLocked
		}

		round, _ := strconv.Atoi(r.Round)

		races = append(races, domain.Race{
			APIRaceID:      fmt.Sprintf("jolpica-%d-%d", season, round),
			GrandPrix:      r.RaceName,
			CircuitName:    r.Circuit.CircuitName,
			Country:        r.Circuit.Location.Country,
			FP1Time:        fp1,
			QualifyingTime: qualifying,
			RaceTime:       raceTime,
			Season:         season,
			Status:         status,

			// Optional sessions: absent ones stay nil so the app can omit the
			// row rather than print a placeholder time.
			FP2Time:              optionalTime(r.SecondPractice),
			FP3Time:              optionalTime(r.ThirdPractice),
			SprintQualifyingTime: optionalTime(r.SprintQualifying),
			SprintTime:           optionalTime(r.Sprint),
		})
	}

	sort.Slice(races, func(i, j int) bool { return races[i].RaceTime.Before(races[j].RaceTime) })
	return races, nil
}

// FetchLatestDrivers returns the current grid, keyed by the three letter code
// (VER, NOR, ...) so ids stay identical to the ones OpenF1 produced and any
// predictions already stored against them remain valid.
//
// Driver standings are preferred over the plain driver list because they carry
// the constructor and only include drivers who have actually raced — the
// /drivers endpoint also lists reserves, which would clutter the picker.
func (c *F1Client) FetchLatestDrivers(ctx context.Context, season int) ([]domain.Driver, error) {
	drivers, err := c.driversFromStandings(ctx, season)
	if err == nil && len(drivers) > 0 {
		return drivers, nil
	}
	// Before the first race of a season the standings are empty, so fall back
	// to the entry list. Teams are unknown there and are left blank.
	return c.driversFromEntryList(ctx, season)
}

// FetchDriverStandings returns the official Drivers' Championship table for the
// season, ordered by position. Empty before the season's first race.
func (c *F1Client) FetchDriverStandings(ctx context.Context, season int) ([]domain.DriverStanding, error) {
	var out ergastStandingsResponse
	url := fmt.Sprintf("%s/%d/driverstandings/?format=json&limit=100", c.baseURL, season)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return nil, err
	}
	lists := out.MRData.StandingsTable.StandingsLists
	if len(lists) == 0 {
		return []domain.DriverStanding{}, nil
	}

	atoi := func(s string) int { n, _ := strconv.Atoi(s); return n }
	// Points can be fractional (half points); round to the nearest whole point.
	pts := func(s string) int { f, _ := strconv.ParseFloat(s, 64); return int(f + 0.5) }

	rows := lists[0].DriverStandings
	standings := make([]domain.DriverStanding, 0, len(rows))
	for _, s := range rows {
		team, colour := "", ""
		if len(s.Constructors) > 0 {
			team = s.Constructors[0].Name
			colour = teamColors[s.Constructors[0].ConstructorID]
		}
		standings = append(standings, domain.DriverStanding{
			Position:      atoi(s.Position),
			Points:        pts(s.Points),
			Wins:          atoi(s.Wins),
			DriverID:      driverCode(s.Driver),
			BroadcastName: s.Driver.GivenName + " " + s.Driver.FamilyName,
			TeamName:      team,
			TeamColor:     colour,
		})
	}
	return standings, nil
}

// FetchQualifyingResult returns the pole sitter's driver code for a round, or
// "" if qualifying hasn't been classified by Jolpica yet.
func (c *F1Client) FetchQualifyingResult(ctx context.Context, season, round int) (string, error) {
	var out ergastQualifyingResponse
	url := fmt.Sprintf("%s/%d/%d/qualifying/?format=json", c.baseURL, season, round)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return "", err
	}
	races := out.MRData.RaceTable.Races
	if len(races) == 0 {
		return "", nil
	}
	for _, r := range races[0].QualifyingResults {
		if r.Position == "1" {
			return driverCode(r.Driver), nil
		}
	}
	return "", nil
}

// FetchRaceResult returns the top three driver codes for a round, or empty
// strings for any position Jolpica hasn't classified yet (e.g. mid-race, or
// before results are published).
func (c *F1Client) FetchRaceResult(ctx context.Context, season, round int) (p1, p2, p3 string, err error) {
	var out ergastResultsResponse
	url := fmt.Sprintf("%s/%d/%d/results/?format=json", c.baseURL, season, round)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return "", "", "", err
	}
	races := out.MRData.RaceTable.Races
	if len(races) == 0 {
		return "", "", "", nil
	}
	for _, r := range races[0].Results {
		switch r.Position {
		case "1":
			p1 = driverCode(r.Driver)
		case "2":
			p2 = driverCode(r.Driver)
		case "3":
			p3 = driverCode(r.Driver)
		}
	}
	return p1, p2, p3, nil
}

func (c *F1Client) driversFromStandings(ctx context.Context, season int) ([]domain.Driver, error) {
	var out ergastStandingsResponse
	url := fmt.Sprintf("%s/%d/driverstandings/?format=json&limit=100", c.baseURL, season)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return nil, err
	}
	lists := out.MRData.StandingsTable.StandingsLists
	if len(lists) == 0 {
		return nil, nil
	}

	seen := map[string]bool{}
	drivers := make([]domain.Driver, 0, len(lists[0].DriverStandings))
	for _, s := range lists[0].DriverStandings {
		id := driverCode(s.Driver)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true

		team, colour := "", ""
		if len(s.Constructors) > 0 {
			team = s.Constructors[0].Name
			colour = teamColors[s.Constructors[0].ConstructorID]
		}

		drivers = append(drivers, domain.Driver{
			DriverID:      id,
			BroadcastName: s.Driver.GivenName + " " + s.Driver.FamilyName,
			TeamName:      team,
			TeamColor:     colour,
		})
	}
	sortDrivers(drivers)
	return drivers, nil
}

func (c *F1Client) driversFromEntryList(ctx context.Context, season int) ([]domain.Driver, error) {
	var out ergastDriversResponse
	url := fmt.Sprintf("%s/%d/drivers/?format=json&limit=100", c.baseURL, season)
	if err := c.getJSON(ctx, url, &out); err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	drivers := make([]domain.Driver, 0, len(out.MRData.DriverTable.Drivers))
	for _, d := range out.MRData.DriverTable.Drivers {
		id := driverCode(d)
		// Reserve and test drivers often have no code or number; skipping them
		// keeps the picker to the actual race grid.
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		drivers = append(drivers, domain.Driver{
			DriverID:      id,
			BroadcastName: d.GivenName + " " + d.FamilyName,
		})
	}
	sortDrivers(drivers)
	return drivers, nil
}

func sortDrivers(d []domain.Driver) {
	sort.Slice(d, func(i, j int) bool { return d[i].BroadcastName < d[j].BroadcastName })
}

// driverCode prefers the official three letter code and falls back to an
// uppercased driverId so a driver is never silently dropped.
func driverCode(d ergastDriver) string {
	if d.Code != "" {
		return d.Code
	}
	return ""
}

// optionalTime returns nil for a session this weekend doesn't have, which is
// what distinguishes "no FP2 because it's a sprint weekend" from "FP2 at the
// zero time".
func optionalTime(e *ergastEvent) *time.Time {
	t := eventTime(e)
	if t.IsZero() {
		return nil
	}
	return &t
}

func eventTime(e *ergastEvent) time.Time {
	if e == nil {
		return time.Time{}
	}
	return parseErgastTime(e.Date, e.Time)
}

// parseErgastTime joins Ergast's split date ("2026-03-08") and time
// ("04:00:00Z") fields into a single instant. A missing time means the schedule
// is not confirmed to the hour yet, so the date alone is treated as UTC midnight.
func parseErgastTime(date, clock string) time.Time {
	if date == "" {
		return time.Time{}
	}
	if clock == "" {
		if t, err := time.Parse("2006-01-02", date); err == nil {
			return t.UTC()
		}
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, date+"T"+clock); err == nil {
		return t.UTC()
	}
	return time.Time{}
}
