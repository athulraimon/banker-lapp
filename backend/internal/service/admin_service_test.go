package service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// An admin aiming the account-removal tool at themselves must be refused before
// anything touches the database. Constructed with nil repositories on purpose: if
// the guard ever stops short-circuiting, this panics instead of quietly passing.
func TestDeleteAccountRefusesSelf(t *testing.T) {
	svc := &AdminService{}

	err := svc.DeleteAccount(context.Background(), "admin-1", "admin-1")

	if !errors.Is(err, ErrCannotDeleteSelf) {
		t.Fatalf("want ErrCannotDeleteSelf, got %v", err)
	}
}

// The message is shown to the admin verbatim, so it should point at the place
// that does work rather than just saying no.
func TestErrCannotDeleteSelfPointsAtProfile(t *testing.T) {
	if got := ErrCannotDeleteSelf.Error(); got == "" {
		t.Fatal("error message is empty")
	}
	if !strings.Contains(ErrCannotDeleteSelf.Error(), "profile") {
		t.Errorf("message should direct the admin to their profile, got %q", ErrCannotDeleteSelf.Error())
	}
}
