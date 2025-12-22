import React, { useState } from 'react';
import {
    View,
    TextInput as RNTextInput,
    Text,
    StyleSheet,
    ViewStyle,
    StyleProp,
    TextInputProps as RNTextInputProps,
} from 'react-native';

import theme from '@/constants/theme';

interface InputProps extends RNTextInputProps {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
    label,
    error,
    leftIcon,
    rightIcon,
    containerStyle,
    style,
    ...props
}: InputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View
                style={[
                    styles.inputContainer,
                    isFocused && styles.inputContainerFocused,
                    error && styles.inputContainerError,
                ]}
            >
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                <RNTextInput
                    style={[
                        styles.input,
                        leftIcon ? styles.inputWithLeftIcon : undefined,
                        rightIcon ? styles.inputWithRightIcon : undefined,
                        style,
                    ]}
                    placeholderTextColor={theme.colors.text.muted}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
                {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
    },
    label: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.medium,
        marginBottom: theme.spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.glass.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        overflow: 'hidden',
    },
    inputContainerFocused: {
        borderColor: theme.colors.primary.base,
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    inputContainerError: {
        borderColor: theme.colors.error,
    },
    input: {
        flex: 1,
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.base,
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.md,
    },
    inputWithLeftIcon: {
        paddingLeft: theme.spacing.xs,
    },
    inputWithRightIcon: {
        paddingRight: theme.spacing.xs,
    },
    iconLeft: {
        paddingLeft: theme.spacing.md,
    },
    iconRight: {
        paddingRight: theme.spacing.md,
    },
    error: {
        color: theme.colors.error,
        fontSize: theme.typography.sizes.sm,
        marginTop: theme.spacing.xs,
    },
});

export default Input;
