import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated';

import theme from '@/constants/theme';

const { width } = Dimensions.get('window');
const ORB_SIZE = width * 0.55;

interface GlassOrbProps {
    state?: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export function GlassOrb({ state = 'idle' }: GlassOrbProps) {
    const breathe = useSharedValue(0);
    const rotate = useSharedValue(0);
    const pulse = useSharedValue(0);
    const ripple = useSharedValue(0);

    useEffect(() => {
        // Base breathing animation - always running
        breathe.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        // Continuous rotation of inner gradient
        rotate.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    useEffect(() => {
        switch (state) {
            case 'listening':
                ripple.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 1000, easing: Easing.out(Easing.ease) }),
                        withTiming(0, { duration: 0 })
                    ),
                    -1,
                    false
                );
                break;
            case 'thinking':
                pulse.value = withRepeat(
                    withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                );
                break;
            case 'speaking':
                pulse.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
                        withTiming(0.3, { duration: 300, easing: Easing.in(Easing.ease) })
                    ),
                    -1,
                    false
                );
                break;
            default:
                pulse.value = withTiming(0, { duration: 300 });
                ripple.value = withTiming(0, { duration: 300 });
        }
    }, [state]);

    const orbStyle = useAnimatedStyle(() => {
        const scale = interpolate(breathe.value, [0, 1], [1, 1.03]);
        const pulseScale = interpolate(pulse.value, [0, 1], [1, 1.08]);
        return {
            transform: [{ scale: scale * pulseScale }],
        };
    });

    const innerGradientStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotate.value}deg` }],
    }));

    const glowStyle = useAnimatedStyle(() => {
        const opacity = interpolate(breathe.value, [0, 1], [0.4, 0.7]);
        const pulseOpacity = interpolate(pulse.value, [0, 1], [0, 0.3]);
        return {
            opacity: opacity + pulseOpacity,
        };
    });

    const rippleStyle = useAnimatedStyle(() => {
        const scale = interpolate(ripple.value, [0, 1], [1, 1.5]);
        const opacity = interpolate(ripple.value, [0, 0.3, 1], [0.5, 0.3, 0]);
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <View style={styles.container}>
            {/* Outer glow */}
            <Animated.View style={[styles.glow, glowStyle]} />

            {/* Ripple effect for listening */}
            {state === 'listening' && (
                <Animated.View style={[styles.ripple, rippleStyle]} />
            )}

            {/* Main orb */}
            <Animated.View style={[styles.orb, orbStyle]}>
                {/* Glass background */}
                <LinearGradient
                    colors={[
                        'rgba(139, 92, 246, 0.3)',
                        'rgba(99, 102, 241, 0.2)',
                        'rgba(168, 85, 247, 0.25)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                />

                {/* Animated inner gradient */}
                <Animated.View style={[styles.innerGradientContainer, innerGradientStyle]}>
                    <LinearGradient
                        colors={[
                            'rgba(139, 92, 246, 0.5)',
                            'transparent',
                            'rgba(168, 85, 247, 0.3)',
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.innerGradient}
                    />
                </Animated.View>

                {/* Glass highlight - top left */}
                <View style={styles.highlightTop} />

                {/* Glass highlight - bottom right */}
                <View style={styles.highlightBottom} />

                {/* Inner core glow */}
                <View style={styles.coreGlow}>
                    <LinearGradient
                        colors={[
                            'rgba(255, 255, 255, 0.15)',
                            'rgba(139, 92, 246, 0.2)',
                            'transparent',
                        ]}
                        style={styles.coreGradient}
                    />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: ORB_SIZE + 60,
        height: ORB_SIZE + 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        width: ORB_SIZE + 40,
        height: ORB_SIZE + 40,
        borderRadius: (ORB_SIZE + 40) / 2,
        backgroundColor: theme.colors.primary.base,
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 60,
        elevation: 20,
    },
    ripple: {
        position: 'absolute',
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: ORB_SIZE / 2,
        borderWidth: 2,
        borderColor: theme.colors.primary.light,
    },
    orb: {
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: ORB_SIZE / 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(26, 26, 37, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    innerGradientContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerGradient: {
        width: ORB_SIZE * 1.5,
        height: ORB_SIZE * 1.5,
        borderRadius: (ORB_SIZE * 1.5) / 2,
    },
    highlightTop: {
        position: 'absolute',
        top: ORB_SIZE * 0.08,
        left: ORB_SIZE * 0.15,
        width: ORB_SIZE * 0.35,
        height: ORB_SIZE * 0.15,
        borderRadius: ORB_SIZE * 0.1,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        transform: [{ rotate: '-20deg' }],
    },
    highlightBottom: {
        position: 'absolute',
        bottom: ORB_SIZE * 0.15,
        right: ORB_SIZE * 0.15,
        width: ORB_SIZE * 0.2,
        height: ORB_SIZE * 0.08,
        borderRadius: ORB_SIZE * 0.05,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        transform: [{ rotate: '-20deg' }],
    },
    coreGlow: {
        position: 'absolute',
        top: '30%',
        left: '30%',
        width: '40%',
        height: '40%',
        borderRadius: ORB_SIZE * 0.2,
        overflow: 'hidden',
    },
    coreGradient: {
        flex: 1,
        borderRadius: ORB_SIZE * 0.2,
    },
});

export default GlassOrb;
