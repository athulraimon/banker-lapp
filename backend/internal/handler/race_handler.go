package handler

import (
	"net/http"
	"strconv"
	"log"

	"banker_lapp_backend/internal/middleware"
	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type RaceHandler struct {
	raceService *service.RaceService
}

func NewRaceHandler(raceService *service.RaceService) *RaceHandler {
	return &RaceHandler{raceService: raceService}
}

func (h *RaceHandler) GetRaces(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	seasonStr := c.QueryParam("season")
	season := 2026
	if seasonStr != "" {
		if s, err := strconv.Atoi(seasonStr); err == nil {
			season = s
		}
	}

	races, err := h.raceService.GetRacesForSeason(c.Request().Context(), season)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch races"})
	}

	return c.JSON(http.StatusOK, races)
}

func (h *RaceHandler) GetRace(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	id := c.Param("id")
	race, err := h.raceService.GetRaceByID(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch race"})
	}
	if race == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "race not found"})
	}

	return c.JSON(http.StatusOK, race)
}

func (h *RaceHandler) GetRaceResults(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	id := c.Param("id")
	results, err := h.raceService.GetRaceResults(c.Request().Context(), id, middleware.IsSignedIn(c))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch race results"})
	}

	return c.JSON(http.StatusOK, results)
}

// RegisterRoutes puts the calendar behind optional auth rather than no auth at
// all. The schedule and the official podium are public F1 facts, so a guest can
// browse them; /:id/results additionally returns who predicted what, and that
// part is withheld unless the request carried a real session.
func (h *RaceHandler) RegisterRoutes(e *echo.Echo, optionalAuth echo.MiddlewareFunc) {
	public := e.Group("/races", optionalAuth)
	public.GET("", h.GetRaces)
	public.GET("/:id", h.GetRace)
	public.GET("/:id/results", h.GetRaceResults)
}