import { useState, useCallback, useEffect } from 'react';
import { Box, Grid, Paper, Stack, Text, Group, Button, Badge } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMicrophone, IconKeyboard, IconSparkles } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatPanel } from '@/components/chat';
import { VoiceOrb, FloatingVoiceOrb } from '@/components/voice';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { useChatStore } from '@/stores/chatStore';

export function HomePage() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { isVoiceMode, setVoiceMode } = useChatStore();

  const {
    sendMessage,
    startListening,
    stopListening,
  } = useVoiceAgent({ autoConnect: true });

  // Handle sending messages
  const handleSendMessage = useCallback(
    (message: string) => {
      sendMessage(message);
    },
    [sendMessage]
  );

  // Handle voice start/stop
  const handleStartVoice = useCallback(() => {
    setVoiceMode(true);
    startListening();
  }, [setVoiceMode, startListening]);

  const handleStopVoice = useCallback(() => {
    setVoiceMode(false);
    stopListening();
  }, [setVoiceMode, stopListening]);

  return (
    <Box
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? 0 : '16px', // Manual padding to avoid Mantine AppShell padding issues
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <ChatPanel
        onSendMessage={handleSendMessage}
        onStartVoice={handleStartVoice}
        onStopVoice={handleStopVoice}
        isVoiceActive={isVoiceMode}
      />
    </Box>
  );
}
