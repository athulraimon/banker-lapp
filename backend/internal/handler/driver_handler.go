package handler

import (
	"log"
	"net/http"

	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type DriverHandler struct {
	driverService *service.DriverService
}

func NewDriverHandler(driverService *service.DriverService) *DriverHandler {
	return &DriverHandler{driverService: driverService}
}

func (h *DriverHandler) GetDrivers(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	drivers, err := h.driverService.GetDrivers(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to fetch drivers"})
	}
	return c.JSON(http.StatusOK, drivers)
}

func (h *DriverHandler) GetDriverStandings(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	standings, err := h.driverService.GetDriverStandings(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to fetch driver standings"})
	}
	return c.JSON(http.StatusOK, standings)
}

func (h *DriverHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	protected := e.Group("/drivers", authMiddleware)
	protected.GET("", h.GetDrivers)
	protected.GET("/standings", h.GetDriverStandings)
}
