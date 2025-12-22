/**
 * Spatial Memory App - Design System
 * Premium dark-first glassmorphic theme
 */

export const theme = {
    colors: {
        // Primary gradient - deep space purple to cosmic blue
        primary: {
            gradient: ['#6366F1', '#8B5CF6', '#A855F7'] as const,
            base: '#8B5CF6',
            light: '#A78BFA',
            dark: '#6D28D9',
        },

        // Background layers - ultra dark with subtle blue
        background: {
            primary: '#0A0A0F',
            secondary: '#12121A',
            tertiary: '#1A1A25',
            card: 'rgba(26, 26, 37, 0.8)',
        },

        // Glass effect colors
        glass: {
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'rgba(255, 255, 255, 0.1)',
            highlight: 'rgba(255, 255, 255, 0.15)',
        },

        // Text hierarchy
        text: {
            primary: '#FFFFFF',
            secondary: 'rgba(255, 255, 255, 0.7)',
            muted: 'rgba(255, 255, 255, 0.4)',
        },

        // Accent colors for categories
        accent: {
            cyan: '#22D3EE',
            emerald: '#34D399',
            amber: '#FBBF24',
            rose: '#FB7185',
            blue: '#60A5FA',
            violet: '#A78BFA',
        },

        // Status colors
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
    },

    typography: {
        sizes: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 30,
            '4xl': 36,
            '5xl': 48,
        },
        weights: {
            normal: '400' as const,
            medium: '500' as const,
            semibold: '600' as const,
            bold: '700' as const,
        },
    },

    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        '2xl': 48,
        '3xl': 64,
    },

    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        '2xl': 32,
        full: 9999,
    },

    shadows: {
        glow: {
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 10,
        },
        soft: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
        },
    },
};

// Category configuration with colors and icons
export const categories = {
    electronics: {
        label: 'Electronics',
        icon: 'laptop',
        color: theme.colors.accent.blue,
    },
    documents: {
        label: 'Documents',
        icon: 'document-text-outline',
        color: theme.colors.accent.amber,
    },
    keys: {
        label: 'Keys & Access',
        icon: 'key',
        color: theme.colors.accent.emerald,
    },
    personal: {
        label: 'Personal',
        icon: 'person-outline',
        color: theme.colors.accent.rose,
    },
    home: {
        label: 'Home',
        icon: 'home',
        color: theme.colors.accent.cyan,
    },
    other: {
        label: 'Other',
        icon: 'cube-outline',
        color: theme.colors.accent.violet,
    },
} as const;

export type CategoryKey = keyof typeof categories;

export default theme;
