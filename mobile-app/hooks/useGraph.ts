/**
 * useGraph - React hook for fetching graph data from the API
 * Uses Zustand store for state management with caching
 */
import { useCallback, useRef, useEffect } from 'react';
import { useApi } from '@/services/api';
import { useGraphStore, shouldRefetch } from '@/stores/graphStore';

interface UseGraphOptions {
    autoFetch?: boolean;
    forceRefetch?: boolean; // Force refetch even if cache is valid
}

export function useGraph(options: UseGraphOptions = {}) {
    const { autoFetch = false, forceRefetch = false } = options;
    const api = useApi();
    
    // Use ref to store the getGraph function to avoid recreating fetchGraph on every render
    const getGraphRef = useRef(api.getGraph);
    getGraphRef.current = api.getGraph;

    // Get state from store
    const nodes = useGraphStore((state) => state.nodes);
    const edges = useGraphStore((state) => state.edges);
    const isLoading = useGraphStore((state) => state.isLoading);
    const error = useGraphStore((state) => state.error);
    const isFetching = useGraphStore((state) => state.isFetching);

    // Get store actions
    const setNodes = useGraphStore((state) => state.setNodes);
    const setEdges = useGraphStore((state) => state.setEdges);
    const setLoading = useGraphStore((state) => state.setLoading);
    const setError = useGraphStore((state) => state.setError);
    const setFetching = useGraphStore((state) => state.setFetching);

    // Fetch complete graph data
    const fetchGraph = useCallback(async (skipCache = false) => {
        // Prevent duplicate fetches
        if (useGraphStore.getState().isFetching && !skipCache) {
            return;
        }

        // Check cache validity unless forced
        if (!skipCache && !forceRefetch && !shouldRefetch()) {
            return;
        }

        setFetching(true);
        setLoading(true);
        setError(null);

        try {
            const data = await getGraphRef.current();
            setNodes(data.nodes);
            setEdges(data.edges);
            // Update last fetched timestamp
            useGraphStore.setState({ lastFetched: Date.now() });
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to fetch graph');
            setError(err);
            console.error('Error fetching graph:', err);
        } finally {
            setLoading(false);
            setFetching(false);
        }
    }, [forceRefetch, setNodes, setEdges, setLoading, setError, setFetching]);

    // Refresh graph - always fetches fresh data
    const refresh = useCallback(() => {
        fetchGraph(true);
    }, [fetchGraph]);

    // Stable fetch function for external use (respects cache)
    const fetchGraphLazy = useCallback(() => {
        fetchGraph(false);
    }, [fetchGraph]);

    // Track if we've done initial fetch to prevent multiple calls
    const hasInitialFetchedRef = useRef(false);

    // Auto-fetch on mount if enabled (only once)
    useEffect(() => {
        if (autoFetch && !hasInitialFetchedRef.current && shouldRefetch() && !isFetching) {
            hasInitialFetchedRef.current = true;
            fetchGraph(false);
        }
    }, [autoFetch, fetchGraph, isFetching]);

    return {
        nodes,
        edges,
        isLoading,
        error,
        refresh,
        fetchGraph: fetchGraphLazy,
    };
}
