import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    FadeInRight,
    FadeOutLeft,
} from 'react-native-reanimated';

import theme from '@/constants/theme';

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
    fadeOpacity?: number;
}

export function ChatBubble({ role, content, isStreaming = false, fadeOpacity = 1 }: ChatBubbleProps) {
    const isUser = role === 'user';

    return (
        <Animated.View
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={[styles.container, isUser && styles.containerUser, { opacity: fadeOpacity }]}
        >
            <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
                {content}
                {isStreaming && <Text style={styles.cursor}>▊</Text>}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: theme.spacing.xs / 2,
        width: '100%',
        alignSelf: 'center',
    },
    containerUser: {
        alignSelf: 'center',
    },
    text: {
        fontSize: theme.typography.sizes.sm,
        lineHeight: 20,
        textAlign: 'center',
    },
    userText: {
        color: theme.colors.text.secondary,
    },
    assistantText: {
        color: theme.colors.text.muted,
    },
    cursor: {
        color: theme.colors.primary.base,
        opacity: 0.6,
    },
});

export default ChatBubble;
