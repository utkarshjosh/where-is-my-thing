/**
 * API Client for Spatial Memory Backend
 * Uses Clerk for authentication
 */

import type { ItemsResponse, Item, GraphData, UserProfile } from './types';
import { useRateLimitStore } from '@/stores/rateLimitStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiClient {
  private getToken: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getToken = getter;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    const wsBase = API_BASE_URL
      ? API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://')
      : `ws://${window.location.host}`;
    return `${wsBase}/agent/voice?token=${encodeURIComponent(token)}`;
  }
}

export const apiClient = new ApiClient();
