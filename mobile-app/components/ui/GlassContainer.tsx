import React from 'react';
import {
    View,
    StyleSheet,
    ViewStyle,
    StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import theme from '@/constants/theme';

interface GlassContainerProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'card' | 'subtle';
    glowColor?: string;
    showGlow?: boolean;
    blurIntensity?: number;
}

export function GlassContainer({
    children,
    style,
    variant = 'default',
    glowColor = theme.colors.primary.base,
    showGlow = false,
    blurIntensity = 40,
}: GlassContainerProps) {
    const containerStyle = [
        styles.container,
        variant === 'card' && styles.cardVariant,
        variant === 'subtle' && styles.subtleVariant,
        showGlow && { ...theme.shadows.glow, shadowColor: glowColor },
        style,
    ];

    return (
        <View style={containerStyle}>
            <BlurView
                intensity={blurIntensity}
                tint="dark"
                style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.borderOverlay} />
            {children}
        </View>
    );
}

interface GradientBorderProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    colors?: readonly [string, string, ...string[]];
    borderWidth?: number;
    borderRadius?: number;
}

export function GradientBorder({
    children,
    style,
    colors = ['#6366F1', '#8B5CF6', '#A855F7'] as const,
    borderWidth = 1,
    borderRadius = theme.borderRadius.lg,
}: GradientBorderProps) {
    return (
        <View style={[styles.gradientBorderContainer, { borderRadius }, style]}>
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius }]}
            />
            <View
                style={[
                    styles.gradientBorderInner,
                    {
                        margin: borderWidth,
                        borderRadius: borderRadius - borderWidth,
                    },
                ]}
            >
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: theme.colors.glass.background,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
    },
    cardVariant: {
        backgroundColor: theme.colors.background.card,
    },
    subtleVariant: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.glass.highlight,
        opacity: 0.5,
    },
    gradientBorderContainer: {
        overflow: 'hidden',
    },
    gradientBorderInner: {
        backgroundColor: theme.colors.background.secondary,
        flex: 1,
    },
});

export default GlassContainer;
