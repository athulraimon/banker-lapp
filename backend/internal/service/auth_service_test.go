package service

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateDisplayName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "plain name", input: "Athul", want: "Athul"},
		{name: "at the minimum", input: "AB", want: "AB"},
		{name: "surrounding space is trimmed", input: "  Speed Demon  ", want: "Speed Demon"},
		{name: "inner spaces are kept", input: "Max  Verstappen", want: "Max  Verstappen"},

		{name: "empty", input: "", wantErr: true},
		{name: "only whitespace", input: "     ", wantErr: true},
		{name: "one character", input: "A", wantErr: true},
		// Trimming happens before the length check, so this is a 1-rune name.
		{name: "one character with padding", input: "   A   ", wantErr: true},
		{name: "too long", input: strings.Repeat("x", DisplayNameMaxLen+1), wantErr: true},
		{name: "at the maximum", input: strings.Repeat("x", DisplayNameMaxLen), want: strings.Repeat("x", DisplayNameMaxLen)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateDisplayName(tc.input)
			if tc.wantErr {
				if !errors.Is(err, ErrInvalidDisplayName) {
					t.Fatalf("want ErrInvalidDisplayName, got err=%v value=%q", err, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// Length is counted in runes, not bytes. A 32-character name in a non-Latin
// script is well over 32 bytes, and rejecting it would be a bug that only shows
// up for some alphabets.
func TestValidateDisplayNameCountsRunesNotBytes(t *testing.T) {
	name := strings.Repeat("ಅ", DisplayNameMaxLen) // 3 bytes per rune
	if len(name) <= DisplayNameMaxLen {
		t.Fatalf("fixture is not multibyte: %d bytes for %d runes", len(name), DisplayNameMaxLen)
	}

	got, err := validateDisplayName(name)
	if err != nil {
		t.Fatalf("a %d-rune name was rejected: %v", DisplayNameMaxLen, err)
	}
	if got != name {
		t.Errorf("got %q, want %q", got, name)
	}
}
