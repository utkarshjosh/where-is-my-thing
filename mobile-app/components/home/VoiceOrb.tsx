/**
 * VoiceOrb - Unified orb component with multiple visual styles
 * Supports switching between different orb types via props or settings
 */

import React, { useState, createContext, useContext, useEffect, Suspense } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Text } from 'react-native';

import { GlassOrb } from './GlassOrb';
import { RingOrb } from './RingOrb';
import theme from '@/constants/theme';

// Try to import AIOrb but fallback gracefully on native
let AIOrb: React.ComponentType<any> | null = null;
if (Platform.OS === 'web') {
    try {
        AIOrb = require('./AIOrb').AIOrb;
    } catch (e) {
        console.log('AIOrb not available, using fallback');
    }
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type OrbType = 'glass' | 'ring' | 'blob' | 'auto';

interface VoiceOrbProps {
    state?: OrbState;
    size?: number;
    type?: OrbType;
}

// Context for orb type preference (can be set from settings)
interface OrbPreferenceContextType {
    orbType: OrbType;
    setOrbType: (type: OrbType) => void;
}

const OrbPreferenceContext = createContext<OrbPreferenceContextType>({
    orbType: 'ring',
    setOrbType: () => { },
});

export const useOrbPreference = () => useContext(OrbPreferenceContext);

export function OrbPreferenceProvider({ children }: { children: React.ReactNode }) {
    const [orbType, setOrbType] = useState<OrbType>('ring');

    // Could load from AsyncStorage here
    // useEffect(() => { loadFromStorage() }, []);

    return (
        <OrbPreferenceContext.Provider value={{ orbType, setOrbType }}>
            {children}
        </OrbPreferenceContext.Provider>
    );
}

// Simple fallback for when orb can't render
function FallbackOrb({ size }: { size: number }) {
    return (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
            <View style={[styles.fallbackInner, { borderRadius: size / 2 }]} />
        </View>
    );
}

// Main VoiceOrb component
export function VoiceOrb({ state = 'idle', size, type }: VoiceOrbProps) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.55;
    const { orbType: preferredType } = useOrbPreference();

    // Determine which orb to use
    const effectiveType = type || preferredType;

    // Auto mode: use Ring on native, Blob on web
    const resolvedType: Exclude<OrbType, 'auto'> =
        effectiveType === 'auto'
            ? (Platform.OS === 'web' && AIOrb ? 'blob' : 'ring')
            : effectiveType;

    // Render based on type
    switch (resolvedType) {
        case 'blob':
            if (AIOrb && Platform.OS === 'web') {
                return (
                    <Suspense fallback={<FallbackOrb size={orbSize} />}>
                        <AIOrb state={state} size={orbSize} />
                    </Suspense>
                );
            }
            // Fallback to ring if blob not available
            return <RingOrb state={state} size={orbSize} />;

        case 'ring':
            return <RingOrb state={state} size={orbSize} />;

        case 'glass':
        default:
            return <GlassOrb state={state} />;
    }
}

// Export for convenience
export { GlassOrb } from './GlassOrb';
export { RingOrb } from './RingOrb';

// Orb type options for settings UI
export const orbTypeOptions = [
    { value: 'glass' as OrbType, label: 'Glass', description: 'Classic glass sphere' },
    { value: 'ring' as OrbType, label: 'Ring', description: 'Pulsing ring with tension' },
    { value: 'blob' as OrbType, label: 'Blob', description: 'Organic morphing blob (web only)' },
    { value: 'auto' as OrbType, label: 'Auto', description: 'Best for your platform' },
];

const styles = StyleSheet.create({
    fallback: {
        backgroundColor: theme.colors.primary.base,
        opacity: 0.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackInner: {
        width: '80%',
        height: '80%',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
});

export default VoiceOrb;
