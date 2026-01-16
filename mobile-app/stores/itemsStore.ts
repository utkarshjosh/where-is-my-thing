/**
 * Items Store - Zustand store for managing items data with caching
 */
import { create } from 'zustand';
import { Item } from '@/services/api';

interface ItemsState {
    items: Item[];
    isLoading: boolean;
    error: Error | null;
    lastFetched: number | null;
    isFetching: boolean; // Track if a fetch is in progress to prevent duplicate calls
    searchQuery: string;
    
    // Actions
    setItems: (items: Item[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: Error | null) => void;
    setFetching: (fetching: boolean) => void;
    setSearchQuery: (query: string) => void;
    reset: () => void;
}

const CACHE_DURATION = 1 * 60 * 1000; // 5 minutes

export const useItemsStore = create<ItemsState>((set) => ({
    items: [],
    isLoading: false,
    error: null,
    lastFetched: null,
    isFetching: false,
    searchQuery: '',

    setItems: (items) => set({ items }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setFetching: (isFetching) => set({ isFetching }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    
    reset: () => set({
        items: [],
        isLoading: false,
        error: null,
        lastFetched: null,
        isFetching: false,
        searchQuery: '',
    }),
}));

/**
 * Check if cached data is still valid
 */
export const isItemsCacheValid = (): boolean => {
    const lastFetched = useItemsStore.getState().lastFetched;
    if (!lastFetched) return false;
    return Date.now() - lastFetched < CACHE_DURATION;
};

/**
 * Check if items data needs to be refetched (cache expired or no data)
 */
export const shouldRefetchItems = (): boolean => {
    const { items, lastFetched, isFetching } = useItemsStore.getState();
    // Don't refetch if already fetching
    if (isFetching) return false;
    // Refetch if no data
    if (items.length === 0) return true;
    // Refetch if cache expired
    if (!lastFetched || Date.now() - lastFetched >= CACHE_DURATION) return true;
    return false;
};








