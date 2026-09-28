package domain

import (
	"testing"
	"time"
)

func TestPredictionWindowStatus(t *testing.T) {
	fp1 := time.Date(2026, 8, 21, 10, 30, 0, 0, time.UTC)  // Dutch GP FP1
	prev := time.Date(2026, 7, 26, 13, 0, 0, 0, time.UTC)  // Hungarian GP start
	openFrom := prev.Add(RaceDuration) // race day, RaceDuration after start

	cases := []struct {
		name string
		now  time.Time
		want string
	}{
		{"before the previous race", prev.Add(-time.Hour), StatusUpcoming},
		{"during the previous race", prev.Add(time.Hour), StatusUpcoming},
		{"one minute before it ends", openFrom.Add(-time.Minute), StatusUpcoming},
		{"exactly when it ends", openFrom, StatusUpcoming},
		{"a minute after it ends", openFrom.Add(time.Minute), StatusOpen},
		{"a week later, still before FP1", fp1.Add(-7 * 24 * time.Hour), StatusOpen},
		{"exactly at FP1", fp1, StatusOpen},
		{"a minute after FP1", fp1.Add(time.Minute), StatusLocked},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := PredictionWindowStatus(fp1, openFrom, c.now); got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

// Round 1 has no preceding race, so it must not sit in "upcoming" forever.
func TestFirstRaceOfSeasonOpensImmediately(t *testing.T) {
	fp1 := time.Date(2026, 3, 6, 1, 30, 0, 0, time.UTC)
	got := PredictionWindowStatus(fp1, time.Time{}, fp1.Add(-90*24*time.Hour))
	if got != StatusOpen {
		t.Errorf("round 1 three months out = %q, want %q", got, StatusOpen)
	}
}

// The headline behaviour: the next race takes over RaceDuration after the
// previous one starts, not a fixed number of days before its own FP1.
func TestSeasonRolloverAtRaceEnd(t *testing.T) {
	hungary := Race{
		GrandPrix: "Hungarian", RaceTime: time.Date(2026, 7, 26, 13, 0, 0, 0, time.UTC),
		FP1Time: time.Date(2026, 7, 24, 11, 30, 0, 0, time.UTC),
	}
	netherlands := Race{
		GrandPrix: "Dutch", RaceTime: time.Date(2026, 8, 23, 13, 0, 0, 0, time.UTC),
		FP1Time: time.Date(2026, 8, 21, 10, 30, 0, 0, time.UTC),
	}
	season := []Race{hungary, netherlands}

	// Mid-race in Hungary: Hungary locked, Netherlands not yet active.
	during := DeriveSeasonStatuses(season, hungary.RaceTime.Add(time.Hour))
	if during[0].Status != StatusLocked {
		t.Errorf("Hungary during its race = %q, want %q", during[0].Status, StatusLocked)
	}
	if during[1].Status != StatusUpcoming {
		t.Errorf("Netherlands during Hungary = %q, want %q", during[1].Status, StatusUpcoming)
	}

	// A minute past RaceDuration after lights out in Hungary: the Netherlands is
	// now the active GP, even though its own FP1 is nearly four weeks away.
	after := DeriveSeasonStatuses(season, hungary.RaceTime.Add(RaceDuration+time.Minute))
	if after[1].Status != StatusOpen {
		t.Errorf("Netherlands after Hungary finished = %q, want %q", after[1].Status, StatusOpen)
	}
}

func TestDeriveSeasonStatusesLeavesCompletedAlone(t *testing.T) {
	fp1 := time.Date(2026, 3, 6, 1, 30, 0, 0, time.UTC)
	season := []Race{{FP1Time: fp1, RaceTime: fp1.Add(48 * time.Hour), Status: StatusCompleted}}

	got := DeriveSeasonStatuses(season, fp1.Add(365*24*time.Hour))
	if got[0].Status != StatusCompleted {
		t.Errorf("completed race became %q", got[0].Status)
	}
}

// Callers pass slices straight from the repository; deriving must not rewrite
// them in place.
func TestDeriveSeasonStatusesDoesNotMutateInput(t *testing.T) {
	fp1 := time.Now().Add(-time.Hour)
	season := []Race{{FP1Time: fp1, RaceTime: fp1.Add(48 * time.Hour), Status: StatusUpcoming}}

	_ = DeriveSeasonStatuses(season, time.Now())
	if season[0].Status != StatusUpcoming {
		t.Errorf("input mutated to %q", season[0].Status)
	}
}

func TestIsOver(t *testing.T) {
	start := time.Date(2026, 7, 26, 13, 0, 0, 0, time.UTC)
	race := Race{RaceTime: start}

	if race.IsOver(start.Add(RaceDuration - time.Minute)) {
		t.Error("race reported over before RaceDuration had elapsed")
	}
	if !race.IsOver(start.Add(RaceDuration + time.Minute)) {
		t.Error("race not reported over after RaceDuration")
	}
}
