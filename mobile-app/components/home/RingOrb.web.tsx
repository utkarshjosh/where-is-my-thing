/**
 * RingOrb - Web version with audio-reactive animations
 * A glowing ring orb that reacts to voice input with dynamic, unpredictable motion
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withSpring,
    Easing,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useDerivedValue,
    cancelAnimation,
} from 'react-native-reanimated';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface RingOrbProps {
    state?: OrbState;
    size?: number;
}

const ORB_COLORS = {
    idle: '#8B5CF6',
    listening: '#06B6D4',
    thinking: '#10B981',
    speaking: '#EC4899',
};

// Audio analysis hook
function useAudioMeter(isActive: boolean) {
    const volume = useSharedValue(0);
    const bass = useSharedValue(0);
    const mid = useSharedValue(0);
    const treble = useSharedValue(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!isActive) {
            // Clean up and reset values
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            volume.value = withTiming(0, { duration: 300 });
            bass.value = withTiming(0, { duration: 300 });
            mid.value = withTiming(0, { duration: 300 });
            treble.value = withTiming(0, { duration: 300 });
            return;
        }

        const startAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;

                const analyser = audioContext.createAnalyser();
                analyserRef.current = analyser;
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;

                const microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const update = () => {
                    if (!analyserRef.current) return;

                    analyserRef.current.getByteFrequencyData(dataArray);

                    // Calculate frequency bands
                    const bassEnd = Math.floor(bufferLength * 0.15);
                    const midEnd = Math.floor(bufferLength * 0.5);

                    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;

                    for (let i = 0; i < bufferLength; i++) {
                        const val = dataArray[i];
                        totalSum += val;

                        if (i < bassEnd) {
                            bassSum += val;
                        } else if (i < midEnd) {
                            midSum += val;
                        } else {
                            trebleSum += val;
                        }
                    }

                    // Normalize values (0-1 range with some headroom)
                    const avgVolume = Math.min((totalSum / bufferLength) / 128, 1);
                    const avgBass = Math.min((bassSum / bassEnd) / 180, 1);
                    const avgMid = Math.min((midSum / (midEnd - bassEnd)) / 150, 1);
                    const avgTreble = Math.min((trebleSum / (bufferLength - midEnd)) / 120, 1);

                    // Update shared values (these run on JS thread)
                    volume.value = avgVolume;
                    bass.value = avgBass;
                    mid.value = avgMid;
                    treble.value = avgTreble;

                    animationFrameRef.current = requestAnimationFrame(update);
                };

                update();
            } catch (err) {
                console.warn('Audio metering failed:', err);
            }
        };

        startAudio();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isActive]);

    return { volume, bass, mid, treble };
}

export function RingOrb({ state = 'idle', size }: RingOrbProps) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.55;

    // Audio reactivity
    const isListening = state === 'listening';
    const { volume, bass, mid, treble } = useAudioMeter(isListening);

    // Animation values
    const breathe = useSharedValue(0);
    const glowIntensity = useSharedValue(0.5);

    // Dynamic rotation values - driven by audio
    const accentRotation = useSharedValue(0);
    const rotationVelocity = useSharedValue(0);
    const targetRotation = useSharedValue(0);

    // Random motion accumulator
    const randomOffset = useSharedValue(0);
    const lastBassSpike = useSharedValue(0);

    // Base breathing animation (subtle, always running)
    useEffect(() => {
        breathe.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    // Audio-reactive rotation logic
    useAnimatedReaction(
        () => ({ b: bass.value, m: mid.value, t: treble.value, v: volume.value }),
        (current, previous) => {
            if (!previous) return;

            // Detect bass spikes for sudden movements
            const bassSpike = current.b - (previous.b || 0);
            const midChange = current.m - (previous.m || 0);

            // Bass creates sudden direction changes
            if (bassSpike > 0.15) {
                // Random direction flip on bass hits
                const direction = Math.random() > 0.5 ? 1 : -1;
                rotationVelocity.value = direction * (2 + current.b * 8);
                lastBassSpike.value = Date.now();
            }

            // Mid frequencies modulate speed
            const baseSpeed = current.m * 3;

            // Treble adds jitter
            const jitter = current.t * (Math.random() - 0.5) * 2;

            // Apply rotation with audio-driven velocity
            const currentVelocity = rotationVelocity.value;
            const decay = 0.95; // Gradual slowdown

            // Update rotation
            accentRotation.value = accentRotation.value + currentVelocity + baseSpeed + jitter;

            // Decay velocity (creates stop-start effect)
            rotationVelocity.value = currentVelocity * decay;

            // Add random offset based on volume
            if (current.v > 0.3) {
                randomOffset.value = (Math.random() - 0.5) * current.v * 20;
            }
        },
        [bass, mid, treble, volume]
    );

    // State-specific glow
    useEffect(() => {
        switch (state) {
            case 'idle':
                glowIntensity.value = withTiming(0.4, { duration: 500 });
                break;
            case 'listening':
                glowIntensity.value = withTiming(0.8, { duration: 300 });
                break;
            case 'thinking':
                glowIntensity.value = withRepeat(
                    withSequence(
                        withTiming(0.9, { duration: 600 }),
                        withTiming(0.5, { duration: 600 })
                    ),
                    -1,
                    true
                );
                break;
            case 'speaking':
                glowIntensity.value = withTiming(1, { duration: 200 });
                break;
        }

        // Reset rotation velocity when not listening
        if (state !== 'listening') {
            rotationVelocity.value = withTiming(0, { duration: 500 });
        }
    }, [state]);

    // Ring container - audio-reactive scale
    const containerStyle = useAnimatedStyle(() => {
        // When listening, scale is driven by audio
        const audioScale = state === 'listening'
            ? 1 + volume.value * 0.15 + bass.value * 0.1
            : 1;

        // Subtle breathing when idle
        const breatheScale = interpolate(breathe.value, [0, 1], [0.98, 1.02]);

        const finalScale = state === 'listening' ? audioScale : breatheScale;

        return {
            transform: [{ scale: finalScale }],
        };
    });

    // Main ring - glow driven by audio
    const ringStyle = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];

        // Border width pulses with bass
        const audioBorderWidth = state === 'listening'
            ? 2 + bass.value * 4
            : 3;

        const shadowOpacity = interpolate(glowIntensity.value, [0, 1], [0.3, 0.8]);
        const shadowRadius = state === 'listening'
            ? 15 + volume.value * 30
            : interpolate(glowIntensity.value, [0, 1], [15, 35]);

        return {
            width: orbSize * 0.7,
            height: orbSize * 0.7,
            borderRadius: orbSize * 0.35,
            borderWidth: audioBorderWidth,
            borderColor: baseColor,
            shadowColor: baseColor,
            shadowOpacity,
            shadowRadius,
            shadowOffset: { width: 0, height: 0 },
        };
    });

    // Inner glow ring
    const innerGlowStyle = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];
        const opacity = state === 'listening'
            ? 0.1 + mid.value * 0.4
            : interpolate(glowIntensity.value, [0, 1], [0.1, 0.3]);

        return {
            width: orbSize * 0.55,
            height: orbSize * 0.55,
            borderRadius: orbSize * 0.275,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: baseColor,
            opacity,
        };
    });

    // Outer glow ring - gentle audio reaction
    const outerGlowStyle = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];
        const audioScale = state === 'listening'
            ? 1 + bass.value * 0.15
            : interpolate(breathe.value, [0, 1], [1, 1.1]);

        const opacity = state === 'listening'
            ? 0.2 + volume.value * 0.3
            : interpolate(breathe.value, [0, 1], [0.3, 0.15]);

        return {
            width: orbSize * 0.85,
            height: orbSize * 0.85,
            borderRadius: orbSize * 0.425,
            borderWidth: 1,
            borderColor: baseColor,
            opacity,
            transform: [{ scale: audioScale }],
        };
    });

    // Accent ring - dynamic audio-driven rotation with variable speed
    const accentRingStyle = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];

        // Opacity pulses with treble
        const opacity = state === 'listening'
            ? 0.3 + treble.value * 0.5
            : 0.5;

        return {
            width: orbSize * 0.6,
            height: orbSize * 0.6,
            borderRadius: orbSize * 0.3,
            borderWidth: 1.5,
            borderColor: 'transparent',
            borderTopColor: baseColor,
            borderRightColor: baseColor,
            opacity,
            transform: [
                { rotate: `${accentRotation.value + randomOffset.value}deg` }
            ],
        };
    });

    // Second accent ring - counter-rotation for visual interest
    const accentRing2Style = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];

        return {
            width: orbSize * 0.5,
            height: orbSize * 0.5,
            borderRadius: orbSize * 0.25,
            borderWidth: 1,
            borderColor: 'transparent',
            borderBottomColor: baseColor,
            borderLeftColor: baseColor,
            opacity: state === 'listening' ? 0.2 + mid.value * 0.4 : 0.3,
            transform: [
                { rotate: `${-accentRotation.value * 0.7}deg` }
            ],
        };
    });

    // Core glow - strong audio reaction
    const coreStyle = useAnimatedStyle(() => {
        const baseColor = ORB_COLORS[state];

        // Size pulses strongly with bass
        const baseSize = orbSize * 0.08;
        const coreSize = state === 'listening'
            ? baseSize + bass.value * orbSize * 0.06
            : baseSize + interpolate(glowIntensity.value, [0, 1], [0, orbSize * 0.02]);

        const opacity = state === 'listening'
            ? 0.6 + volume.value * 0.4
            : interpolate(glowIntensity.value, [0, 1], [0.5, 1]);

        return {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: baseColor,
            opacity,
            shadowColor: baseColor,
            shadowOpacity: 1,
            shadowRadius: state === 'listening' ? 6 + bass.value * 12 : 10,
            shadowOffset: { width: 0, height: 0 },
        };
    });

    return (
        <View style={[styles.container, { width: orbSize, height: orbSize }]}>
            {/* Outer glow ring */}
            <Animated.View style={[styles.ring, styles.centered, outerGlowStyle]} />

            {/* Main ring */}
            <Animated.View style={[styles.ringContainer, containerStyle]}>
                <Animated.View style={[styles.ring, styles.centered, ringStyle]} />
            </Animated.View>

            {/* Counter-rotating accent ring */}
            <Animated.View style={[styles.ring, styles.centered, accentRing2Style]} />

            {/* Accent spinning ring - now audio-driven! */}
            <Animated.View style={[styles.ring, styles.centered, accentRingStyle]} />

            {/* Inner glow ring */}
            <Animated.View style={[styles.ring, styles.centered, innerGlowStyle]} />

            {/* Core glow */}
            <Animated.View style={[styles.core, coreStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        backgroundColor: 'transparent',
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    core: {
        position: 'absolute',
    },
});

export default RingOrb;
