import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    StyleProp,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import theme from '@/constants/theme';

interface ButtonProps {
    title?: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    haptic?: boolean;
    children?: React.ReactNode;
}

export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    style,
    textStyle,
    haptic = true,
    children,
}: ButtonProps) {
    const handlePress = () => {
        if (haptic && Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress();
    };

    const buttonStyle = [
        styles.base,
        styles[size],
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'icon' && styles.icon,
        disabled && styles.disabled,
        style,
    ];

    const content = (
        <>
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' ? '#fff' : theme.colors.primary.base}
                    size="small"
                />
            ) : (
                <>
                    {icon}
                    {title && (
                        <Text
                            style={[
                                styles.text,
                                styles[`${size}Text`],
                                variant === 'secondary' && styles.secondaryText,
                                variant === 'ghost' && styles.ghostText,
                                textStyle,
                            ]}
                        >
                            {title}
                        </Text>
                    )}
                    {children}
                </>
            )}
        </>
    );

    if (variant === 'primary' && !disabled) {
        return (
            <TouchableOpacity
                onPress={handlePress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[styles.gradientWrapper, style]}
            >
                <LinearGradient
                    colors={['#6366F1', '#8B5CF6', '#A855F7'] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.base, styles[size], styles.gradient]}
                >
                    {content}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            style={buttonStyle}
        >
            {content}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.md,
        gap: 8,
    },
    gradientWrapper: {
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
    },
    gradient: {
        overflow: 'hidden',
    },
    sm: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        minHeight: 36,
    },
    md: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        minHeight: 48,
    },
    lg: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        minHeight: 56,
    },
    secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary.base,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    icon: {
        backgroundColor: theme.colors.glass.background,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        padding: 12,
        borderRadius: theme.borderRadius.full,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        color: '#fff',
        fontWeight: theme.typography.weights.semibold,
        textAlign: 'center',
    },
    smText: {
        fontSize: theme.typography.sizes.sm,
    },
    mdText: {
        fontSize: theme.typography.sizes.base,
    },
    lgText: {
        fontSize: theme.typography.sizes.lg,
    },
    secondaryText: {
        color: theme.colors.primary.base,
    },
    ghostText: {
        color: theme.colors.text.secondary,
    },
});

export default Button;
