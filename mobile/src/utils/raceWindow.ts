// Mirrors backend/internal/domain/race.go's RaceDuration: how long after
// lights out a Grand Prix is treated as finished. Kept in one place so the
// "weekend over" badge, the calendar's Upcoming/Done split, and the
// results/prediction screens' auto-refresh window can never drift apart.
export const RACE_DURATION_MS = 3 * 60 * 60 * 1000;

export function isWeekendOver(raceTimeIso: string, now: number = Date.now()): boolean {
  return now > new Date(raceTimeIso).getTime() + RACE_DURATION_MS;
}
