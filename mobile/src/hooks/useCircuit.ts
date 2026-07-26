import { useQuery } from '@tanstack/react-query';
import { circuitIdFor, fetchCircuitLayout, CircuitLayout } from '../data/circuits';

/**
 * Loads the circuit layout for a race.
 *
 * Layouts never change, so this is cached aggressively — refetching a fixed
 * GPS trace on every screen visit would be wasted bandwidth. A circuit the
 * dataset doesn't cover resolves to null rather than erroring, so the Info tab
 * simply omits the map instead of showing a failure.
 */
export function useCircuit(circuitName?: string, country?: string) {
  const circuitId = circuitName ? circuitIdFor(circuitName, country ?? '') : null;

  const query = useQuery<CircuitLayout>({
    queryKey: ['circuit', circuitId],
    queryFn: () => fetchCircuitLayout(circuitId as string),
    enabled: !!circuitId,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  return {
    circuit: query.data ?? null,
    isLoading: !!circuitId && query.isLoading,
    /** True when we have no layout to show, for any reason. */
    unavailable: !circuitId || query.isError,
  };
}
