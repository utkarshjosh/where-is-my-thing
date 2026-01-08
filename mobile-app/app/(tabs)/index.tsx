import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import theme from '@/constants/theme';
import { VoiceOrb } from '@/components/home/VoiceOrb';
import { ChatBubble } from '@/components/home/ChatBubble';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { useVoiceAgent, VoiceState, Transcript } from '@/hooks/useVoiceAgent';

const { height } = Dimensions.get('window');

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const previousTranscriptLengthRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice agent hook - connected to backend
  const {
    state: voiceState,
    isConnected,
    transcripts,
    error,
    connect,
    startListening,
    stopListening,
    sendMessage,
  } = useVoiceAgent({
    onTranscript: () => {
      // Auto-scroll when new transcript arrives
      scrollViewRef.current?.scrollToEnd({ animated: true });
    },
    onError: (err) => {
      console.error('Voice agent error:', err);
    },
  });

  // Auto-connect on mount
  React.useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  // Map voice state to orb state
  const getOrbState = (): OrbState => {
    switch (voiceState) {
      case 'listening':
        return 'listening';
      case 'thinking':
      case 'connecting':
        return 'thinking';
      case 'speaking':
        return 'speaking';
      default:
        return 'idle';
    }
  };

  const orbState = getOrbState();

  const handleVoicePressIn = useCallback(async () => {
    // Start recording when user presses down
    await startListening();
  }, [startListening]);

  const handleVoicePressOut = useCallback(async () => {
    // Stop recording and send audio when user releases
    await stopListening();
  }, [stopListening]);

  const handleQuickAction = useCallback((action: string) => {
    sendMessage(action);
  }, [sendMessage]);

  // Auto-scroll text from beginning at reading speed (~2 words/second)
  React.useEffect(() => {
    if (transcripts.length > 0) {
      const latestTranscript = transcripts[transcripts.length - 1];
      const currentTextLength = latestTranscript?.text?.length || 0;
      const previousTextLength = previousTranscriptLengthRef.current;
      
      // Only auto-scroll if text length increased (new or updated message)
      if (currentTextLength > previousTextLength && latestTranscript?.text) {
        // Clear any existing scroll timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // Calculate reading time: ~2 words per second = 500ms per word
        const words = latestTranscript.text.split(/\s+/).length;
        const readingTimeMs = Math.min((words / 2) * 1000, 5000); // 2 words/sec, max 5 seconds
        
        // Start from top of the new message
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        
        // Scroll to end smoothly over reading time
        scrollTimeoutRef.current = setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, readingTimeMs);
      }
      
      // Update ref for next comparison
      previousTranscriptLengthRef.current = currentTextLength;
    }
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [transcripts]);

  // Show only the latest conversation (last 2 messages)
  const visibleMessages = React.useMemo(() => {
    if (transcripts.length === 0) return [];
    return transcripts.slice(-2);
  }, [transcripts]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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

      <View style={styles.content}>
        {/* Glass Orb - The Brain - Made Important */}
        <View style={styles.orbContainer}>
          <VoiceOrb
            state={orbState}
            type="ring"
            size={Dimensions.get('window').width * 0.65}
            onPressIn={handleVoicePressIn}
            onPressOut={handleVoicePressOut}
          />
          <Text style={styles.statusText}>
            {orbState === 'idle' && 'Hold'}
            {orbState === 'listening' && 'Listening...'}
            {orbState === 'thinking' && 'Thinking...'}
            {orbState === 'speaking' && 'Speaking...'}
          </Text>
          {voiceState === 'connecting' && (
            <ActivityIndicator size="small" color={theme.colors.primary.base} style={styles.loader} />
          )}
        </View>

        {/* Transcript Area - Fading text, no bubbles */}
        <View style={[styles.transcriptArea, { bottom: 140 + insets.bottom }]}>
          {visibleMessages.length > 0 ? (
            <View style={styles.transcriptContainer}>
              {/* Top Fade - Stronger */}
              <LinearGradient
                colors={[theme.colors.background.primary, 'transparent']}
                style={styles.fadeOverlayTop}
                pointerEvents="none"
              />

              <ScrollView
                ref={scrollViewRef}
                style={styles.transcriptScroll}
                contentContainerStyle={styles.transcriptContent}
                showsVerticalScrollIndicator={false}
              >
                {visibleMessages.map((transcript, index) => {
                  // Fade older messages more
                  const opacity = index === 0 ? 0.8 : Math.max(0.2, 0.8 - (index * 0.3));
                  return (
                    <ChatBubble
                      key={transcript.id}
                      role={transcript.role}
                      content={transcript.text}
                      isStreaming={voiceState === 'speaking' && transcript.role === 'assistant'}
                      fadeOpacity={opacity}
                    />
                  );
                })}
              </ScrollView>

              {/* Bottom Fade - Stronger */}
              <LinearGradient
                colors={['transparent', theme.colors.background.primary]}
                style={styles.fadeOverlayBottom}
                pointerEvents="none"
              />
            </View>
          ) : (
            // Placeholder or empty space when no chat
            <View style={styles.emptyStateContainer} />
          )}

          {error && (
            <GlassContainer style={styles.errorContainer}>
              <Text style={styles.errorText}>{error.message}</Text>
            </GlassContainer>
          )}
        </View>

        {/* Quick Actions - Overlay at bottom, smaller */}
        <View style={[styles.quickActions, { bottom: 20 }]}>
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
      </View>
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
    zIndex: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
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
    justifyContent: 'flex-start',
    paddingBottom: theme.spacing.md,
    overflow: 'visible',
  },
  orbContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    justifyContent: 'center',
    minHeight: height * 0.45, // Reduced space to bring orb up
  },
  statusText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.base,
    marginTop: theme.spacing.md,
    fontWeight: theme.typography.weights.medium,
    opacity: 0.8,
  },
  loader: {
    marginTop: theme.spacing.sm,
  },
  transcriptArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: height * 0.22, // Increased height for better visibility
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none', // Allow touches to pass through
  },
  transcriptContainer: {
    flex: 1,
    position: 'relative',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
  },
  fadeOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 1,
  },
  fadeOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 1,
  },
  emptyStateContainer: {
    flex: 1,
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
  quickActions: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    justifyContent: 'center',
    zIndex: 10,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.glass.background,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    opacity: 0.9,
  },
  quickActionText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.sm,
  },
});
