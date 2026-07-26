import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { driversApi, Driver } from '../api/drivers';

// Shared driver grid, fetched once and cached, so every screen can map a
// driver acronym (VER) to a full name and team.
export function useDrivers() {
  const query = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.getDrivers,
    staleTime: 1000 * 60 * 30,
  });

  const byId = useMemo(() => {
    const map: Record<string, Driver> = {};
    (query.data ?? []).forEach((d) => {
      map[d.driver_id] = d;
    });
    return map;
  }, [query.data]);

  return { drivers: query.data ?? [], byId, isLoading: query.isLoading, error: query.error };
}
