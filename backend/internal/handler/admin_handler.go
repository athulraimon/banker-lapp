package handler

import (
	"log"
	"net/http"
	"strconv"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/middleware"
	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type AdminHandler struct {
	adminService  *service.AdminService
	defaultSeason int
}

func NewAdminHandler(adminService *service.AdminService, defaultSeason int) *AdminHandler {
	return &AdminHandler{adminService: adminService, defaultSeason: defaultSeason}
}

// SyncSchedule pulls the real Grand Prix calendar from OpenF1.
func (h *AdminHandler) SyncSchedule(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	season := h.defaultSeason
	if s := c.QueryParam("season"); s != "" {
		parsed, err := strconv.Atoi(s)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid season"})
		}
		season = parsed
	}
	count, err := h.adminService.SyncSchedule(c.Request().Context(), season)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{"message": "schedule synced", "races": count, "season": season})
}

type setResultsRequest struct {
	PoleDriverID string `json:"pole_driver_id"`
	P1DriverID   string `json:"p1_driver_id"`
	P2DriverID   string `json:"p2_driver_id"`
	P3DriverID   string `json:"p3_driver_id"`
}

// SetResults records the official podium+pole and rescores the race.
func (h *AdminHandler) SetResults(c echo.Context) error {
	raceID := c.Param("id")
	log.Printf("Handling %s %s for raceID: %s", c.Request().Method, c.Request().URL.Path, raceID)
	var req setResultsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	result := &domain.RaceResult{
		RaceID:       raceID,
		PoleDriverID: req.PoleDriverID,
		P1DriverID:   req.P1DriverID,
		P2DriverID:   req.P2DriverID,
		P3DriverID:   req.P3DriverID,
	}
	if err := h.adminService.SetRaceResults(c.Request().Context(), raceID, result); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "results saved and scores recalculated"})
}

// ClearResults removes a race's official result and derived scores.
func (h *AdminHandler) ClearResults(c echo.Context) error {
	raceID := c.Param("id")
	log.Printf("Handling %s %s for raceID: %s", c.Request().Method, c.Request().URL.Path, raceID)
	if err := h.adminService.ClearRaceResults(c.Request().Context(), raceID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "results cleared"})
}

// RecalculateScores re-runs scoring for an already-resulted race.
func (h *AdminHandler) RecalculateScores(c echo.Context) error {
	raceID := c.Param("id")
	log.Printf("Handling %s %s for raceID: %s", c.Request().Method, c.Request().URL.Path, raceID)
	if err := h.adminService.RecalculateScores(c.Request().Context(), raceID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "scores recalculated successfully"})
}

// ListPredictions returns all users and their prediction for a race.
func (h *AdminHandler) ListPredictions(c echo.Context) error {
	raceID := c.Param("id")
	log.Printf("Handling %s %s for raceID: %s", c.Request().Method, c.Request().URL.Path, raceID)
	views, err := h.adminService.ListRacePredictions(c.Request().Context(), raceID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list predictions"})
	}
	return c.JSON(http.StatusOK, views)
}

type adminPredictionRequest struct {
	PoleDriverID string `json:"pole_driver_id"`
	P1DriverID   string `json:"p1_driver_id"`
	P2DriverID   string `json:"p2_driver_id"`
	P3DriverID   string `json:"p3_driver_id"`
}

// UpsertPrediction lets the admin set or correct any user's prediction.
func (h *AdminHandler) UpsertPrediction(c echo.Context) error {
	raceID := c.Param("id")
	userID := c.Param("userId")
	log.Printf("Handling %s %s (race=%s user=%s)", c.Request().Method, c.Request().URL.Path, raceID, userID)
	var req adminPredictionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	pred := &domain.Prediction{
		UserID:       userID,
		RaceID:       raceID,
		PoleDriverID: req.PoleDriverID,
		P1DriverID:   req.P1DriverID,
		P2DriverID:   req.P2DriverID,
		P3DriverID:   req.P3DriverID,
	}
	if err := h.adminService.AdminUpsertPrediction(c.Request().Context(), pred); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "prediction updated"})
}

func (h *AdminHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	adminGroup := e.Group("/admin", authMiddleware, middleware.AdminMiddleware)
	adminGroup.POST("/schedule/sync", h.SyncSchedule)
	adminGroup.PUT("/races/:id/results", h.SetResults)
	adminGroup.DELETE("/races/:id/results", h.ClearResults)
	adminGroup.POST("/races/:id/recalculate", h.RecalculateScores)
	adminGroup.GET("/races/:id/predictions", h.ListPredictions)
	adminGroup.PUT("/races/:id/users/:userId/prediction", h.UpsertPrediction)
}
