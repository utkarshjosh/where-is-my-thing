/**
 * Graph Store - Zustand store for managing graph data with caching
 */
import { create } from 'zustand';
import { GraphNode, GraphEdge } from '@/services/api';

interface GraphState {
    nodes: GraphNode[];
    edges: GraphEdge[];
    isLoading: boolean;
    error: Error | null;
    lastFetched: number | null;
    isFetching: boolean; // Track if a fetch is in progress to prevent duplicate calls
    
    // Actions
    setNodes: (nodes: GraphNode[]) => void;
    setEdges: (edges: GraphEdge[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: Error | null) => void;
    setFetching: (fetching: boolean) => void;
    reset: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useGraphStore = create<GraphState>((set) => ({
    nodes: [],
    edges: [],
    isLoading: false,
    error: null,
    lastFetched: null,
    isFetching: false,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setFetching: (isFetching) => set({ isFetching }),
    
    reset: () => set({
        nodes: [],
        edges: [],
        isLoading: false,
        error: null,
        lastFetched: null,
        isFetching: false,
    }),
}));

/**
 * Check if cached data is still valid
 */
export const isCacheValid = (): boolean => {
    const lastFetched = useGraphStore.getState().lastFetched;
    if (!lastFetched) return false;
    return Date.now() - lastFetched < CACHE_DURATION;
};

/**
 * Check if data needs to be refetched (cache expired or no data)
 */
export const shouldRefetch = (): boolean => {
    const { nodes, lastFetched, isFetching } = useGraphStore.getState();
    // Don't refetch if already fetching
    if (isFetching) return false;
    // Refetch if no data
    if (nodes.length === 0) return true;
    // Refetch if cache expired
    if (!lastFetched || Date.now() - lastFetched >= CACHE_DURATION) return true;
    return false;
};



