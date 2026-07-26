package handler

import (
	"net/http"
	"log"

	"banker_lapp_backend/internal/service"

	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	authService    *service.AuthService
	enableDevLogin bool
}

func NewAuthHandler(authService *service.AuthService, enableDevLogin bool) *AuthHandler {
	return &AuthHandler{authService: authService, enableDevLogin: enableDevLogin}
}

type GoogleLoginRequest struct {
	IDToken string `json:"id_token"`
}

func (h *AuthHandler) GoogleLogin(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	var req GoogleLoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.IDToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id_token is required"})
	}

	resp, err := h.authService.VerifyGoogleTokenAndLogin(c.Request().Context(), req.IDToken)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) DevLogin(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	resp, err := h.authService.DevLogin(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create dev session"})
	}

	return c.JSON(http.StatusOK, resp)
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) RefreshToken(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	var req RefreshRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
	}

	resp, err := h.authService.RefreshToken(c.Request().Context(), req.RefreshToken)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Logout(c echo.Context) error {
	log.Printf("Handling %s %s", c.Request().Method, c.Request().URL.Path)
	userID, ok := c.Get("user_id").(string)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	err := h.authService.Logout(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to logout"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "logged out successfully"})
}

func (h *AuthHandler) RegisterRoutes(e *echo.Echo, authMiddleware echo.MiddlewareFunc) {
	e.POST("/auth/google", h.GoogleLogin)
	e.POST("/auth/refresh", h.RefreshToken)

	// DevLogin issues an admin session with no credentials, so the route only
	// exists when explicitly enabled (never in production).
	if h.enableDevLogin {
		e.POST("/auth/dev", h.DevLogin)
		log.Println("[auth] dev login route registered at POST /auth/dev")
	}

	protected := e.Group("/auth", authMiddleware)
	protected.POST("/logout", h.Logout)
}