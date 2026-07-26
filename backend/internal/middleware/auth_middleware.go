package middleware

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"banker_lapp_backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

func AuthMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			log.Printf("[AuthMiddleware] Incoming request - Method: %s, URL: %s, AuthHeader: %s", c.Request().Method, c.Request().URL, authHeader)
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				log.Printf("[AuthMiddleware] Rejected - missing or invalid token")
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing or invalid token"})
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					log.Printf("[AuthMiddleware] Unexpected signing method: %v", token.Header["alg"])
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(cfg.JWTSecret), nil
			})

			if err != nil {
				log.Printf("[AuthMiddleware] Token parse error: %v", err)
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
			}
			if !token.Valid {
				log.Printf("[AuthMiddleware] Token is not valid")
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				log.Printf("[AuthMiddleware] Failed to cast claims")
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token claims"})
			}
			log.Printf("[AuthMiddleware] Successfully authenticated - user_id: %v, is_admin: %v", claims["user_id"], claims["is_admin"])

			// Add to context
			c.Set("user_id", claims["user_id"])
			c.Set("is_admin", claims["is_admin"])

			return next(c)
		}
	}
}

func AdminMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isAdmin, ok := c.Get("is_admin").(bool)
		if !ok || !isAdmin {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "admin access required"})
		}
		return next(c)
	}
}
