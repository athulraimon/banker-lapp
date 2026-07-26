# Build stage
FROM golang:1.26-alpine AS build
WORKDIR /src

# Cache module downloads
COPY go.mod go.sum ./
RUN go mod download

# Build the static binary (migrations are embedded via go:embed)
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/api ./cmd/api

# Runtime stage
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/api /app/api
USER app

ENV PORT=8080 APP_ENV=production
EXPOSE 8080

# Container platforms hit /health for liveness and /ready for readiness.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/api"]
