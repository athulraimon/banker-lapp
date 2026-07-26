package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"banker_lapp_backend/internal/config"
	"banker_lapp_backend/internal/database"
	"banker_lapp_backend/internal/handler"
	"banker_lapp_backend/internal/middleware"
	"banker_lapp_backend/internal/repository"
	"banker_lapp_backend/internal/scheduler"
	"banker_lapp_backend/internal/service"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.LoadConfig()

	// Connect to Database with pool configuration
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to parse database config: %v\n", err)
	}
	poolConfig.MaxConns = 20
	poolConfig.MinConns = 5
	poolConfig.HealthCheckPeriod = 5 * time.Minute

	dbPool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v\n", err)
	}
	defer dbPool.Close()

	// Verify database connectivity with retry
	if err := verifyDBConnection(context.Background(), dbPool, 10); err != nil {
		log.Fatalf("Failed to connect to database: %v\n", err)
	}
	log.Println("Database connection verified successfully")

	if cfg.AutoMigrate {
		if err := database.Migrate(context.Background(), dbPool); err != nil {
			log.Fatalf("Failed to run migrations: %v\n", err)
		}
	}

	// Initialize Echo Server
	e := echo.New()

	e.HideBanner = true

	// Middleware
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	// CORS only started mattering once the app began running in a browser; the
	// native app is not subject to it. Any header the web client sends that is
	// not listed here fails the preflight and the request never reaches a route.
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAuthorization,
			// Sent by the API client to skip ngrok's interstitial. It is a
			// custom header, so it turns every request into a preflighted one —
			// omitting it here breaks all browser calls, not just ngrok ones.
			"ngrok-skip-browser-warning",
		},
	}))

	// Init Repos
	userRepo := repository.NewUserRepository(dbPool)
	raceRepo := repository.NewRaceRepository(dbPool)
	predRepo := repository.NewPredictionRepository(dbPool)
	scoreRepo := repository.NewScoreRepository(dbPool)
	resultRepo := repository.NewResultRepository(dbPool)
	refreshRepo := repository.NewRefreshTokenRepository(dbPool)

	// Init Services
	authService := service.NewAuthService(userRepo, refreshRepo, cfg)
	raceService := service.NewRaceService(raceRepo, resultRepo, scoreRepo, predRepo)
	predService := service.NewPredictionService(predRepo, raceRepo)
	scoreService := service.NewScoringService(scoreRepo, resultRepo, predRepo)
	adminService := service.NewAdminService(raceRepo, resultRepo, scoreRepo, predRepo, userRepo, scoreService)
	driverService := service.NewDriverService()

	// Init Handlers
	authHandler := handler.NewAuthHandler(authService, cfg.EnableDevLogin)
	raceHandler := handler.NewRaceHandler(raceService)
	predHandler := handler.NewPredictionHandler(predService)
	standingsHandler := handler.NewStandingsHandler(scoreService)
	adminHandler := handler.NewAdminHandler(adminService, cfg.DefaultSeason)
	driverHandler := handler.NewDriverHandler(driverService)

	// Custom Middlewares
	authMiddleware := middleware.AuthMiddleware(cfg)

	// Register Routes
	authHandler.RegisterRoutes(e, authMiddleware)
	raceHandler.RegisterRoutes(e, authMiddleware)
	predHandler.RegisterRoutes(e, authMiddleware)
	standingsHandler.RegisterRoutes(e, authMiddleware)
	adminHandler.RegisterRoutes(e, authMiddleware)
	driverHandler.RegisterRoutes(e, authMiddleware)

	// Start Scheduler
	cronScheduler := scheduler.NewScheduler(refreshRepo)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Liveness: the process is up. Used by platform health checks.
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Readiness: dependencies are reachable. Used before routing traffic here.
	e.GET("/ready", func(c echo.Context) error {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
		defer cancel()

		if err := dbPool.Ping(ctx); err != nil {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "degraded", "database": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
	})

	go func() {
		log.Printf("Server starting on port %s (env=%s)", cfg.ServerPort, cfg.Env)
		if err := e.Start(":" + cfg.ServerPort); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	// Drain in-flight requests on SIGINT/SIGTERM so deploys don't drop traffic.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown signal received, draining connections...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
	log.Println("Server stopped")
}

func verifyDBConnection(ctx context.Context, pool *pgxpool.Pool, maxRetries int) error {
	var err error
	for i := 0; i < maxRetries; i++ {
		err = pool.Ping(ctx)
		if err == nil {
			return nil
		}
		log.Printf("Database ping failed (attempt %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("database connection failed after %d attempts: %w", maxRetries, err)
}
