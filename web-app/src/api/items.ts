/**
 * TanStack Query hooks for Items API
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { ItemsResponse, Item } from './types';

export const itemsKeys = {
  all: ['items'] as const,
  lists: () => [...itemsKeys.all, 'list'] as const,
  list: (filters: { limit?: number; offset?: number }) => [...itemsKeys.lists(), filters] as const,
  search: (query: string) => [...itemsKeys.all, 'search', query] as const,
  details: () => [...itemsKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemsKeys.details(), id] as const,
};

export function useItems(limit = 50, offset = 0) {
  return useQuery<ItemsResponse>({
    queryKey: itemsKeys.list({ limit, offset }),
    queryFn: () => apiClient.getItems(limit, offset),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useSearchItems(query: string, enabled = true) {
  return useQuery<ItemsResponse>({
    queryKey: itemsKeys.search(query),
    queryFn: () => apiClient.searchItems(query),
    enabled: enabled && query.length > 0,
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function useItem(id: string) {
  return useQuery<Item>({
    queryKey: itemsKeys.detail(id),
    queryFn: () => apiClient.getItem(id),
    enabled: !!id,
  });
}
