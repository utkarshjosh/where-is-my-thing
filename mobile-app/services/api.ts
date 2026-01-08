/**
 * API Service for Spatial Memory Backend
 * 
 * Provides typed API calls for items, graph, and user endpoints.
 * Uses Clerk for authentication.
 */
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import { useMemo } from 'react';

// Types
export interface Item {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    location: string | null;
    location_path: string | null;
    category: string;
}

export interface ItemsResponse {
    items: Item[];
    count: number;
}

export interface GraphNode {
    id: string;
    label: string;
    type: 'thing' | 'place' | 'intent';
    category: string | null;
    x?: number;
    y?: number;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: string;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface UserProfile {
    id: string;
    clerk_user_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
}

// API Configuration
const getApiBaseUrl = (): string => {
    if (process.env.NODE_ENV === 'development') {
        // Use localhost or your local IP for development
        const hostUri = Constants.expoConfig?.hostUri;
        if (hostUri) {
            const host = hostUri.split(':')[0];
            return `http://${host}:5000`;
        }
        return 'http://localhost:5000';
    }

    // Production URL
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
        throw new Error('EXPO_PUBLIC_API_BASE_URL not configured');
    }
    return baseUrl;
};

// API Client class
class ApiClient {
    private baseUrl: string;
    private getToken: (() => Promise<string | null>) | null = null;

    constructor() {
        this.baseUrl = getApiBaseUrl();
    }

    setTokenGetter(getter: () => Promise<string | null>) {
        this.getToken = getter;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // Add auth token if available
        if (this.getToken) {
            const token = await this.getToken();
            if (token) {
                (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Items API
    async getItems(limit = 50, offset = 0): Promise<ItemsResponse> {
        return this.request<ItemsResponse>(`/items?limit=${limit}&offset=${offset}`);
    }

    async searchItems(query: string, limit = 20): Promise<ItemsResponse> {
        return this.request<ItemsResponse>(`/items/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    async getItem(id: string): Promise<Item> {
        return this.request<Item>(`/items/${id}`);
    }

    // Graph API
    async getGraph(): Promise<GraphData> {
        return this.request<GraphData>('/graph');
    }

    async getGraphNodes(): Promise<GraphNode[]> {
        return this.request<GraphNode[]>('/graph/nodes');
    }

    async getGraphEdges(): Promise<GraphEdge[]> {
        return this.request<GraphEdge[]>('/graph/edges');
    }

    // User API
    async getProfile(): Promise<UserProfile> {
        return this.request<UserProfile>('/user/profile');
    }

    // WebSocket URL for voice
    getVoiceWebSocketUrl(token: string): string {
        const wsBase = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        return `${wsBase}/agent/voice?token=${encodeURIComponent(token)}`;
    }
}

// Singleton instance
export const apiClient = new ApiClient();

// React hook for API with auth
export function useApi() {
    const { getToken } = useAuth();

    // Set the token getter
    apiClient.setTokenGetter(getToken);

    // Memoize the API object to prevent infinite loops in hooks that depend on it
    return useMemo(() => ({
        // Items
        getItems: apiClient.getItems.bind(apiClient),
        searchItems: apiClient.searchItems.bind(apiClient),
        getItem: apiClient.getItem.bind(apiClient),

        // Graph
        getGraph: apiClient.getGraph.bind(apiClient),
        getGraphNodes: apiClient.getGraphNodes.bind(apiClient),
        getGraphEdges: apiClient.getGraphEdges.bind(apiClient),

        // User
        getProfile: apiClient.getProfile.bind(apiClient),

        // Voice WebSocket URL
        getVoiceWebSocketUrl: async () => {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            return apiClient.getVoiceWebSocketUrl(token);
        },
    }), [getToken]);
}
