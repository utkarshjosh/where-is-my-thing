/**
 * useItems - React hook for fetching and searching items from the API
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi, Item, ItemsResponse } from '@/services/api';

interface UseItemsOptions {
    autoFetch?: boolean;
    limit?: number;
}

export function useItems(options: UseItemsOptions = {}) {
    const { autoFetch = true, limit = 50 } = options;
    const api = useApi();

    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Debounce timer ref
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Store API methods in ref to avoid recreating callbacks
    const apiRef = useRef(api);
    apiRef.current = api;

    // Fetch all items
    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await apiRef.current.getItems(limit, 0);
            setItems(response.items);
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to fetch items');
            setError(err);
            console.error('Error fetching items:', err);
        } finally {
            setIsLoading(false);
        }
    }, [limit]);

    // Search items with debounce
    const search = useCallback(async (query: string) => {
        // Clear previous timer
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        setSearchQuery(query);

        // If empty query, fetch all
        if (!query.trim()) {
            fetchItems();
            return;
        }

        // Debounce search by 300ms
        searchTimerRef.current = setTimeout(async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await apiRef.current.searchItems(query, limit);
                setItems(response.items);
            } catch (e) {
                const err = e instanceof Error ? e : new Error('Search failed');
                setError(err);
                console.error('Error searching items:', err);
            } finally {
                setIsLoading(false);
            }
        }, 300);
    }, [fetchItems, limit]);

    // Get single item
    const getItem = useCallback(async (id: string): Promise<Item | null> => {
        try {
            return await apiRef.current.getItem(id);
        } catch (e) {
            console.error('Error fetching item:', e);
            return null;
        }
    }, []);

    // Refresh items
    const refresh = useCallback(() => {
        if (searchQuery) {
            search(searchQuery);
        } else {
            fetchItems();
        }
    }, [fetchItems, search, searchQuery]);

    // Auto-fetch on mount - only run once when autoFetch changes
    useEffect(() => {
        if (autoFetch) {
            fetchItems();
        }

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFetch]);

    return {
        items,
        isLoading,
        error,
        searchQuery,
        search,
        refresh,
        getItem,
        fetchItems,
    };
}
