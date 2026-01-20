/**
 * TanStack Query hooks for Graph API
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { GraphData } from './types';

export const graphKeys = {
  all: ['graph'] as const,
  data: () => [...graphKeys.all, 'data'] as const,
};

export function useGraph() {
  return useQuery<GraphData>({
    queryKey: graphKeys.data(),
    queryFn: () => apiClient.getGraph(),
    staleTime: 30 * 1000, // 30 seconds
  });
}
