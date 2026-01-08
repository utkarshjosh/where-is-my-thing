/**
 * VoiceOrb - Unified orb component with multiple visual styles
 * Supports switching between different orb types via props or settings
 */

import React, { useState, createContext, useContext, useEffect, Suspense } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Text, TouchableOpacity } from 'react-native';

import { GlassOrb } from './GlassOrb';
import { RingOrb } from './RingOrb';
import { CSSRingOrb } from './CSSRingOrb';
import { AIOrb } from './AIOrb';
import theme from '@/constants/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type OrbType = 'glass' | 'ring' | 'css-ring' | 'blob' | 'auto';

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
    orbType: 'blob', // Default to the most premium one
    setOrbType: () => { },
});

export const useOrbPreference = () => useContext(OrbPreferenceContext);

export function OrbPreferenceProvider({ children }: { children: React.ReactNode }) {
    const [orbType, setOrbType] = useState<OrbType>('blob');

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
export function VoiceOrb({ 
    state = 'idle', 
    size, 
    type, 
    onPressIn, 
    onPressOut 
}: VoiceOrbProps & { 
    onPressIn?: () => void;
    onPressOut?: () => void;
}) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.55;
    const { orbType: preferredType } = useOrbPreference();

    // Determine which orb to use
    const effectiveType = type || preferredType;

    // Auto mode: use Blob (AIOrb) as it's the most advanced
    const resolvedType: Exclude<OrbType, 'auto'> =
        effectiveType === 'auto' ? 'blob' : effectiveType;

    const renderOrb = () => {
        switch (resolvedType) {
            case 'blob':
                return (
                    <Suspense fallback={<FallbackOrb size={orbSize} />}>
                        <AIOrb state={state} size={orbSize} />
                    </Suspense>
                );

            case 'ring':
                return <RingOrb state={state} size={orbSize} />;

            case 'css-ring':
                return <CSSRingOrb state={state} size={orbSize} />;

            case 'glass':
            default:
                return <GlassOrb state={state} />;
        }
    };

    if (onPressIn || onPressOut) {
        return (
            <TouchableOpacity 
                onPressIn={onPressIn} 
                onPressOut={onPressOut}
                activeOpacity={0.9}
            >
                {renderOrb()}
            </TouchableOpacity>
        );
    }

    return renderOrb();
}

// Export for convenience
export { GlassOrb } from './GlassOrb';
export { RingOrb } from './RingOrb';

// Orb type options for settings UI
export const orbTypeOptions = [
    { value: 'glass' as OrbType, label: 'Glass', description: 'Classic glass sphere' },
    { value: 'ring' as OrbType, label: 'Ring', description: 'Pulsing ring with tension' },
    { value: 'css-ring' as OrbType, label: 'CSS Ring', description: 'Pure CSS ring with glow effects' },
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
