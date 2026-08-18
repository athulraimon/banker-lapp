package handler

import (
	"log"
	"net/http"

	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type StandingsHandler struct {
	scoringService *service.ScoringService
}

func NewStandingsHandler(scoringService *service.ScoringService) *StandingsHandler {
	return &StandingsHandler{scoringService: scoringService}
}

func (h *StandingsHandler) GetGlobalStandings(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	standings, err := h.scoringService.GetGlobalStandings(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch standings"})
	}

	return c.JSON(http.StatusOK, standings)
}

// GetPlayerProfile returns one player's season breakdown.
//
// Any signed-in player may view any other's. That matches what the app already
// shows: the race breakdown screen lists every competitor's picks for a finished
// race. The service only returns resulted races, so this exposes nothing that
// was still secret.
func (h *StandingsHandler) GetPlayerProfile(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	userID := c.Param("userId")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing user id"})
	}

	profile, err := h.scoringService.GetPlayerProfile(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch player profile"})
	}
	if profile == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "player not found"})
	}

	return c.JSON(http.StatusOK, profile)
}

func (h *StandingsHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	protected := e.Group("/standings", authMiddleware)
	protected.GET("", h.GetGlobalStandings)
	protected.GET("/players/:userId", h.GetPlayerProfile)
}
