/**
 * useItems - React hook for fetching and searching items from the API
 * Uses Zustand store for state management with caching
 */
import { useCallback, useRef, useEffect } from 'react';
import { useApi, Item } from '@/services/api';
import { useItemsStore, shouldRefetchItems } from '@/stores/itemsStore';

interface UseItemsOptions {
    autoFetch?: boolean;
    limit?: number;
    forceRefetch?: boolean; // Force refetch even if cache is valid
}

export function useItems(options: UseItemsOptions = {}) {
    const { autoFetch = true, limit = 50, forceRefetch = false } = options;
    const api = useApi();

    // Debounce timer ref
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Store API methods in ref to avoid recreating callbacks
    const apiRef = useRef(api);
    apiRef.current = api;

    // Get state from store
    const items = useItemsStore((state) => state.items);
    const isLoading = useItemsStore((state) => state.isLoading);
    const error = useItemsStore((state) => state.error);
    const isFetching = useItemsStore((state) => state.isFetching);
    const searchQuery = useItemsStore((state) => state.searchQuery);

    // Get store actions
    const setItems = useItemsStore((state) => state.setItems);
    const setLoading = useItemsStore((state) => state.setLoading);
    const setError = useItemsStore((state) => state.setError);
    const setFetching = useItemsStore((state) => state.setFetching);
    const setSearchQuery = useItemsStore((state) => state.setSearchQuery);

    // Fetch all items
    const fetchItems = useCallback(async (skipCache = false) => {
        // Prevent duplicate fetches
        if (useItemsStore.getState().isFetching && !skipCache) {
            return;
        }

        // Check cache validity unless forced
        if (!skipCache && !forceRefetch && !shouldRefetchItems()) {
            return;
        }

        setFetching(true);
        setLoading(true);
        setError(null);

        try {
            const response = await apiRef.current.getItems(limit, 0);
            setItems(response.items);
            // Update last fetched timestamp
            useItemsStore.setState({ lastFetched: Date.now() });
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to fetch items');
            setError(err);
            console.error('Error fetching items:', err);
        } finally {
            setLoading(false);
            setFetching(false);
        }
    }, [limit, forceRefetch, setItems, setLoading, setError, setFetching]);

    // Search items with debounce
    const search = useCallback(async (query: string) => {
        // Clear previous timer
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        setSearchQuery(query);

        // If empty query, fetch all
        if (!query.trim()) {
            fetchItems(false);
            return;
        }

        // Debounce search by 300ms
        searchTimerRef.current = setTimeout(async () => {
            setFetching(true);
            setLoading(true);
            setError(null);

            try {
                const response = await apiRef.current.searchItems(query, limit);
                setItems(response.items);
                // Update last fetched timestamp for search results
                useItemsStore.setState({ lastFetched: Date.now() });
            } catch (e) {
                const err = e instanceof Error ? e : new Error('Search failed');
                setError(err);
                console.error('Error searching items:', e);
            } finally {
                setLoading(false);
                setFetching(false);
            }
        }, 300);
    }, [fetchItems, limit, setItems, setLoading, setError, setFetching, setSearchQuery]);

    // Get single item
    const getItem = useCallback(async (id: string): Promise<Item | null> => {
        try {
            return await apiRef.current.getItem(id);
        } catch (e) {
            console.error('Error fetching item:', e);
            return null;
        }
    }, []);

    // Refresh items - always fetches fresh data
    const refresh = useCallback(() => {
        if (searchQuery) {
            // Clear search and fetch all items
            setSearchQuery('');
            fetchItems(true);
        } else {
            fetchItems(true);
        }
    }, [fetchItems, searchQuery, setSearchQuery]);

    // Stable fetch function for external use (respects cache)
    const fetchItemsLazy = useCallback(() => {
        fetchItems(false);
    }, [fetchItems]);

    // Track if we've done initial fetch to prevent multiple calls
    const hasInitialFetchedRef = useRef(false);

    // Auto-fetch on mount if enabled (only once)
    useEffect(() => {
        if (autoFetch && !hasInitialFetchedRef.current && shouldRefetchItems() && !isFetching) {
            hasInitialFetchedRef.current = true;
            fetchItems(false);
        }

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, [autoFetch, fetchItems, isFetching]);

    return {
        items,
        isLoading,
        error,
        searchQuery,
        search,
        refresh,
        getItem,
        fetchItems: fetchItemsLazy,
    };
}
