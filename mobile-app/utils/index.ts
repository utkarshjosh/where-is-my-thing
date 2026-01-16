import Constants from 'expo-constants';

/**
 * Generate API URL for both development and production environments
 * Handles the difference between web and mobile Expo environments
 */
export const generateAPIUrl = (relativePath: string): string => {
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    // Priority 1: Environment variable
    const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envBaseUrl) {
        const baseUrl = envBaseUrl.endsWith('/') ? envBaseUrl.slice(0, -1) : envBaseUrl;
        return baseUrl.concat(path);
    }

    if (process.env.NODE_ENV === 'development') {
        // In development, use the Expo dev server URL
        const origin = Constants.experienceUrl?.replace('exp://', 'http://') || 'http://localhost:8081';
        return origin.concat(path);
    }

    throw new Error('EXPO_PUBLIC_API_BASE_URL environment variable is not defined');
};

/**
 * Format time ago string from date
 */
export const timeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
};
