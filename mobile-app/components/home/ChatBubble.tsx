import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    FadeInRight,
    FadeOutLeft,
} from 'react-native-reanimated';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming = false }: ChatBubbleProps) {
    const isUser = role === 'user';

    return (
        <Animated.View
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            style={[styles.container, isUser && styles.containerUser]}
        >
            {isUser ? (
                <View style={styles.userBubble}>
                    <Text style={styles.userText}>{content}</Text>
                </View>
            ) : (
                <GlassContainer style={styles.assistantBubble} variant="card">
                    <Text style={styles.assistantText}>
                        {content}
                        {isStreaming && <Text style={styles.cursor}>▊</Text>}
                    </Text>
                </GlassContainer>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: theme.spacing.xs,
        maxWidth: '85%',
        alignSelf: 'flex-start',
    },
    containerUser: {
        alignSelf: 'flex-end',
    },
    userBubble: {
        backgroundColor: theme.colors.primary.base,
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderBottomRightRadius: theme.borderRadius.sm,
    },
    userText: {
        color: '#fff',
        fontSize: theme.typography.sizes.base,
        lineHeight: 22,
    },
    assistantBubble: {
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        borderBottomLeftRadius: theme.borderRadius.sm,
    },
    assistantText: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.base,
        lineHeight: 22,
    },
    cursor: {
        color: theme.colors.primary.base,
        opacity: 0.8,
    },
});

export default ChatBubble;
