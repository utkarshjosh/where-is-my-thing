import React from 'react';
import {
    TouchableOpacity,
    View,
    StyleSheet,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import theme from '@/constants/theme';

interface VoiceButtonProps {
    isRecording: boolean;
    onPress: () => void;
    disabled?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function VoiceButton({ isRecording, onPress, disabled = false }: VoiceButtonProps) {
    const scale = useSharedValue(1);
    const ring1 = useSharedValue(1);
    const ring2 = useSharedValue(1);
    const ring1Opacity = useSharedValue(0);
    const ring2Opacity = useSharedValue(0);

    useEffect(() => {
        if (isRecording) {
            // Pulsing animation when recording
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );

            // Ring animations
            ring1.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 0 }),
                    withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) })
                ),
                -1,
                false
            );
            ring1Opacity.value = withRepeat(
                withSequence(
                    withTiming(0.6, { duration: 0 }),
                    withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) })
                ),
                -1,
                false
            );

            ring2.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 0 }),
                    withTiming(1.8, { duration: 1500, easing: Easing.out(Easing.ease) })
                ),
                -1,
                false
            );
            ring2Opacity.value = withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 0 }),
                    withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) })
                ),
                -1,
                false
            );
        } else {
            scale.value = withTiming(1, { duration: 200 });
            ring1Opacity.value = withTiming(0, { duration: 200 });
            ring2Opacity.value = withTiming(0, { duration: 200 });
        }
    }, [isRecording]);

    const handlePress = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(
                isRecording ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy
            );
        }
        onPress();
    };

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const ring1Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring1.value }],
        opacity: ring1Opacity.value,
    }));

    const ring2Style = useAnimatedStyle(() => ({
        transform: [{ scale: ring2.value }],
        opacity: ring2Opacity.value,
    }));

    return (
        <View style={styles.container}>
            {/* Animated rings */}
            <Animated.View style={[styles.ring, ring1Style]} />
            <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />

            {/* Main button */}
            <AnimatedTouchable
                onPress={handlePress}
                disabled={disabled}
                activeOpacity={0.8}
                style={[styles.buttonWrapper, buttonStyle]}
            >
                <LinearGradient
                    colors={
                        isRecording
                            ? ['#EF4444', '#DC2626', '#EF4444'] as const
                            : ['#6366F1', '#8B5CF6', '#A855F7'] as const
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                >
                    <Ionicons
                        name={isRecording ? 'stop' : 'mic'}
                        size={32}
                        color="#fff"
                    />
                </LinearGradient>
            </AnimatedTouchable>
        </View>
    );
}

const BUTTON_SIZE = 72;
const RING_SIZE = BUTTON_SIZE + 24;

const styles = StyleSheet.create({
    container: {
        width: RING_SIZE * 1.8,
        height: RING_SIZE * 1.8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 2,
        borderColor: theme.colors.primary.base,
    },
    ring2: {
        borderColor: theme.colors.primary.light,
    },
    buttonWrapper: {
        borderRadius: BUTTON_SIZE / 2,
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    button: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default VoiceButton;
