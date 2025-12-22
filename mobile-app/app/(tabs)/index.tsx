import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
// @ts-ignore - expo/fetch type issues
import { fetch as expoFetch } from 'expo/fetch';

import theme from '@/constants/theme';
import { VoiceOrb } from '@/components/home/VoiceOrb';
import { VoiceButton } from '@/components/home/VoiceButton';
import { ChatBubble } from '@/components/home/ChatBubble';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { generateAPIUrl } from '@/utils';

const { height } = Dimensions.get('window');

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // AI Chat integration
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: (error) => console.error('Chat error:', error),
    onFinish: () => {
      setOrbState('idle');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleVoicePress = useCallback(() => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setOrbState('thinking');
      // TODO: Integrate with speech recognition
      // For now, simulate sending a message
      setTimeout(() => {
        const mockTranscript = "Where did I put my keys?";
        sendMessage({ text: mockTranscript });
        setOrbState('speaking');
      }, 500);
    } else {
      // Start recording
      setIsRecording(true);
      setOrbState('listening');
    }
  }, [isRecording, sendMessage]);

  const handleQuickAction = useCallback((action: string) => {
    setOrbState('thinking');
    sendMessage({ text: action });
    setTimeout(() => setOrbState('speaking'), 500);
  }, [sendMessage]);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Update orb state based on loading
  React.useEffect(() => {
    if (isLoading) {
      setOrbState('speaking');
    }
  }, [isLoading]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color={theme.colors.text.muted} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <Link href="/modal" asChild>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle" size={32} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </Link>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Glass Orb - The Brain */}
        <View style={styles.orbContainer}>
          <VoiceOrb state={orbState} type="ring" />
          <Text style={styles.statusText}>
            {orbState === 'idle' && 'I can help you remember'}
            {orbState === 'listening' && 'Listening...'}
            {orbState === 'thinking' && 'Thinking...'}
            {orbState === 'speaking' && 'Speaking...'}
          </Text>
        </View>

        {/* Chat Area */}
        <View style={styles.chatContainer}>
          {messages.length > 0 ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  role={message.role as 'user' | 'assistant'}
                  content={
                    message.parts
                      ?.filter((p) => p.type === 'text')
                      .map((p) => (p as { type: 'text'; text: string }).text)
                      .join('') || ''
                  }
                  isStreaming={isLoading && message.role === 'assistant'}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                Tap the microphone to start
              </Text>
            </View>
          )}

          {error && (
            <GlassContainer style={styles.errorContainer}>
              <Text style={styles.errorText}>{error.message}</Text>
            </GlassContainer>
          )}
        </View>

        {/* Voice Button */}
        <View style={styles.voiceButtonContainer}>
          <VoiceButton
            isRecording={isRecording}
            onPress={handleVoicePress}
            disabled={isLoading}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickActionPill
            label="remember"
            icon="bookmark-outline"
            onPress={() => handleQuickAction("I want to remember where I put something")}
          />
          <QuickActionPill
            label="ask"
            icon="help-circle-outline"
            onPress={() => handleQuickAction("Where is my...")}
          />
          <QuickActionPill
            label="explore"
            icon="compass-outline"
            onPress={() => handleQuickAction("Show me what items I have stored")}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface QuickActionPillProps {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}

function QuickActionPill({ label, icon, onPress }: QuickActionPillProps) {
  return (
    <TouchableOpacity style={styles.quickActionPill} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={theme.colors.text.muted} />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerCenter: {
    flex: 1,
  },
  settingsButton: {
    padding: theme.spacing.sm,
  },
  profileButton: {
    padding: theme.spacing.xs,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  orbContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  statusText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.base,
    marginTop: theme.spacing.md,
    fontWeight: theme.typography.weights.medium,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    maxHeight: height * 0.25,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingVertical: theme.spacing.sm,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChatText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.base,
  },
  errorContainer: {
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
  voiceButtonContainer: {
    marginTop: theme.spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl + 88, // Account for tab bar
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.glass.background,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
  quickActionText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.sm,
  },
});
