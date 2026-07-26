package handler

import (
	"net/http"
	"log"

	"banker_lapp_backend/internal/domain"
	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type PredictionHandler struct {
	predictionService *service.PredictionService
}

func NewPredictionHandler(predictionService *service.PredictionService) *PredictionHandler {
	return &PredictionHandler{predictionService: predictionService}
}

func (h *PredictionHandler) GetPrediction(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	raceID := c.Param("raceId")
	pred, err := h.predictionService.GetUserPrediction(c.Request().Context(), userID, raceID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch prediction"})
	}

	if pred == nil {
		// Return empty 200 instead of 404 for easier frontend handling
		return c.JSON(http.StatusOK, nil)
	}

	return c.JSON(http.StatusOK, pred)
}

func (h *PredictionHandler) SubmitPrediction(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	var p domain.Prediction
	if err := c.Bind(&p); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	p.UserID = userID

	err := h.predictionService.SubmitPrediction(c.Request().Context(), &p)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "prediction saved"})
}

func (h *PredictionHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	protected := e.Group("/predictions", authMiddleware)
	protected.GET("/:raceId", h.GetPrediction)
	protected.POST("", h.SubmitPrediction)
	protected.PUT("/:id", h.SubmitPrediction) // Same logic for updates before lock
}