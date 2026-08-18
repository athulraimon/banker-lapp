package domain

import "testing"

func TestScorePrediction(t *testing.T) {
	res := &RaceResult{
		PoleDriverID: "VER",
		P1DriverID:   "NOR",
		P2DriverID:   "LEC",
		P3DriverID:   "PIA",
	}

	tests := []struct {
		name          string
		pred          *Prediction
		wantPoints    int
		wantHits      int
		wantP1Correct bool
	}{
		{
			name:          "all four correct",
			pred:          &Prediction{PoleDriverID: "VER", P1DriverID: "NOR", P2DriverID: "LEC", P3DriverID: "PIA"},
			wantPoints:    PointsPole + PointsP1 + PointsP2 + PointsP3,
			wantHits:      4,
			wantP1Correct: true,
		},
		{
			name:       "podium in the wrong order scores nothing",
			pred:       &Prediction{P1DriverID: "PIA", P2DriverID: "NOR", P3DriverID: "LEC"},
			wantPoints: 0,
			wantHits:   0,
		},
		{
			name:          "winner only",
			pred:          &Prediction{P1DriverID: "NOR"},
			wantPoints:    PointsP1,
			wantHits:      1,
			wantP1Correct: true,
		},
		{
			name:       "pole and P3",
			pred:       &Prediction{PoleDriverID: "VER", P3DriverID: "PIA"},
			wantPoints: PointsPole + PointsP3,
			wantHits:   2,
		},
		{
			name:       "no prediction at all",
			pred:       nil,
			wantPoints: 0,
			wantHits:   0,
		},
		{
			name:       "empty picks are not hits",
			pred:       &Prediction{},
			wantPoints: 0,
			wantHits:   0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ScorePrediction(tc.pred, res)
			if got.Points != tc.wantPoints {
				t.Errorf("Points = %d, want %d", got.Points, tc.wantPoints)
			}
			if got.Hits != tc.wantHits {
				t.Errorf("Hits = %d, want %d", got.Hits, tc.wantHits)
			}
			if got.CorrectWinner != tc.wantP1Correct {
				t.Errorf("CorrectWinner = %v, want %v", got.CorrectWinner, tc.wantP1Correct)
			}
		})
	}
}

// An empty slot in the result must not turn an empty pick into a hit. This is
// the case that made compareSlot check for "" explicitly: admins may leave a
// position unset, and "nobody predicted, nobody placed" is not a correct call.
func TestScorePredictionEmptyResultSlot(t *testing.T) {
	res := &RaceResult{PoleDriverID: "", P1DriverID: "NOR"}
	got := ScorePrediction(&Prediction{PoleDriverID: "", P1DriverID: "NOR"}, res)

	if got.Pole.Hit {
		t.Error("empty pole pick against an empty pole result counted as a hit")
	}
	if got.Points != PointsP1 {
		t.Errorf("Points = %d, want %d", got.Points, PointsP1)
	}
}

func TestScorePredictionNilResult(t *testing.T) {
	if got := ScorePrediction(&Prediction{P1DriverID: "NOR"}, nil); got.Points != 0 || got.Hits != 0 {
		t.Errorf("nil result should score nothing, got %+v", got)
	}
}
