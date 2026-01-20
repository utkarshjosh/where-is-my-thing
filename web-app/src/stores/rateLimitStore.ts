import { create } from 'zustand';

interface RateLimitState {
  rateLimitUntil: number | null;
  rateLimitDurationSeconds: number | null;
  rateLimitMessage: string | null;
  setRateLimit: (retryAfterSeconds?: number, message?: string) => void;
  clearRateLimit: () => void;
}

const DEFAULT_RETRY_SECONDS = 60;

export const useRateLimitStore = create<RateLimitState>((set, get) => ({
  rateLimitUntil: null,
  rateLimitDurationSeconds: null,
  rateLimitMessage: null,
  setRateLimit: (retryAfterSeconds, message) => {
    const seconds = Math.max(1, Math.round(retryAfterSeconds ?? DEFAULT_RETRY_SECONDS));
    const until = Date.now() + seconds * 1000;
    const currentUntil = get().rateLimitUntil ?? 0;

    if (until <= currentUntil) {
      return;
    }

    set({
      rateLimitUntil: until,
      rateLimitDurationSeconds: seconds,
      rateLimitMessage: message ?? null,
    });
  },
  clearRateLimit: () =>
    set({
      rateLimitUntil: null,
      rateLimitDurationSeconds: null,
      rateLimitMessage: null,
    }),
}));
