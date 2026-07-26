package handler

import (
	"net/http"
	"log"

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

func (h *StandingsHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	protected := e.Group("/standings", authMiddleware)
	protected.GET("", h.GetGlobalStandings)
}