/**
 * API Client for Spatial Memory Backend
 * Uses Clerk for authentication
 */

import type { ItemsResponse, Item, GraphData, UserProfile } from './types';
import { useRateLimitStore } from '@/stores/rateLimitStore';

// Use /api prefix for Vite proxy in development
// In production, set VITE_API_BASE_URL to the actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private getToken: (() => Promise<string | null>) | null = null;
  private tokenGetterReady: Promise<void>;
  private resolveTokenGetter: (() => void) | null = null;

  constructor() {
    // Create a promise that resolves when token getter is set
    this.tokenGetterReady = new Promise((resolve) => {
      this.resolveTokenGetter = resolve;
    });
  }

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getToken = getter;
    // Signal that token getter is ready
    if (this.resolveTokenGetter) {
      this.resolveTokenGetter();
      this.resolveTokenGetter = null;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Wait for token getter to be set (with timeout)
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Auth setup timeout')), 5000)
    );
    await Promise.race([this.tokenGetterReady, timeout]);

    const url = `${API_BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

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
      const message = error.detail || `HTTP ${response.status}`;

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        useRateLimitStore
          .getState()
          .setRateLimit(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined, message);
      }

      throw new Error(message);
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

  // User API
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/user/profile');
  }

  // WebSocket URL for voice
  getVoiceWebSocketUrl(token: string): string {
    // WebSocket uses /agent path which is proxied separately from /api
    // In development, connect via the Vite dev server's WebSocket proxy
    // In production, use the same host or a configured WebSocket URL
    const wsBase = import.meta.env.VITE_WS_BASE_URL
      ? import.meta.env.VITE_WS_BASE_URL
      : `ws://${window.location.host}`;
    return `${wsBase}/agent/voice?token=${encodeURIComponent(token)}`;
  }
}

export const apiClient = new ApiClient();
