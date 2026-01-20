import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Stack,
  TextInput,
  ActionIcon,
  Paper,
  Text,
  Group,
  Loader,
  Badge,
  Button,
} from '@mantine/core';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import { IconSend, IconMicrophone, IconMicrophoneOff, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from './ChatMessage';
import { useChatStore } from '@/stores/chatStore';
import { VoiceOrb } from '../voice/VoiceOrb';

interface ChatPanelProps {
  onSendMessage: (message: string) => void;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  isVoiceActive?: boolean;
}

export function ChatPanel({
  onSendMessage,
  onStartVoice,
  onStopVoice,
  isVoiceActive,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const { transcripts, voiceState, isConnected, error } = useChatStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [transcripts, voiceState]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useHotkeys([
    ['Enter', () => handleSend()],
    ['mod+Enter', () => handleSend()],
  ]);

  const handleSend = () => {
    const message = inputValue.trim();
    if (message) {
      onSendMessage(message);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceToggle = () => {
    if (isVoiceActive) {
      onStopVoice?.();
    } else {
      onStartVoice?.();
    }
  };

  const isThinking = voiceState === 'thinking' || voiceState === 'connecting';
  const isListening = voiceState === 'listening';
  const isSpeaking = voiceState === 'speaking';

  // On mobile, remove card styling and take full space
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: isMobile ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
    border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    borderRadius: isMobile ? 0 : 'var(--mantine-radius-lg)',
    position: 'relative' as const,
  };

  return (
    <Box style={containerStyle}>
      {/* Voice Overlay */}
      <AnimatePresence>
        {isVoiceActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              background: 'rgba(15, 15, 15, 0.9)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box style={{ position: 'absolute', top: 20, right: 20 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xl"
                onClick={onStopVoice}
              >
                <IconX size={24} />
              </ActionIcon>
            </Box>
            
            <VoiceOrb
              state={voiceState}
              onPressStart={onStartVoice || (() => {})}
              onPressEnd={onStopVoice || (() => {})}
              size={isMobile ? 180 : 240}
            />
            
            <Text mt="xl" c="dimmed" size="sm" ta="center" px="xl">
              {voiceState === 'listening' ? 'I\'m listening...' : 
               voiceState === 'speaking' ? 'I\'m speaking...' : 
               voiceState === 'thinking' ? 'Just a moment...' : 
               'Tap and hold the orb to speak'}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <Box
        p={isMobile ? "sm" : "md"}
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <Text fw={600}>Chat Assistant</Text>
            <Badge
              size="sm"
              variant="dot"
              color={isConnected ? 'green' : 'red'}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </Group>
          {voiceState !== 'idle' && !isVoiceActive && (
            <Badge
              size="sm"
              variant="light"
              color={
                isListening
                  ? 'blue'
                  : isThinking
                  ? 'violet'
                  : isSpeaking
                  ? 'amber'
                  : 'gray'
              }
            >
              {voiceState}
            </Badge>
          )}
        </Group>
      </Box>

      {/* Messages Area - Ensure it's scrollable and takes remaining space */}
      <Box
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack gap="md" p={isMobile ? "sm" : "md"} style={{ flex: 1 }}>
          {transcripts.length === 0 ? (
            <EmptyState onSendMessage={onSendMessage} />
          ) : (
            <AnimatePresence mode="popLayout">
              {transcripts.map((transcript, index) => (
                <ChatMessage
                  key={transcript.id}
                  transcript={transcript}
                  isStreaming={
                    isSpeaking &&
                    index === transcripts.length - 1 &&
                    transcript.role === 'assistant'
                  }
                />
              ))}
            </AnimatePresence>
          )}

          {/* Thinking indicator */}
          {isThinking && !isVoiceActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Group gap="sm">
                <Loader size="sm" color="violet" />
                <Text size="sm" c="dimmed">
                  Thinking...
                </Text>
              </Group>
            </motion.div>
          )}

          {/* Error display */}
          {error && (
            <Paper
              p="sm"
              radius="md"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <Text size="sm" c="red">
                {error.message}
              </Text>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Input Area */}
      <Box
        p={isMobile ? "sm" : "md"}
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <Group gap="sm" align="flex-end">
          <TextInput
            ref={inputRef}
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking || isListening}
            style={{ flex: 1 }}
            styles={{
              input: {
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                minHeight: 44,
                '&:focus': {
                  borderColor: '#f59e0b',
                },
              },
            }}
          />

          <Group gap="xs">
            {/* Voice toggle button */}
            <ActionIcon
              size="xl"
              radius="md"
              variant={isVoiceActive ? 'filled' : 'light'}
              color={isVoiceActive ? 'red' : 'amber'}
              onClick={handleVoiceToggle}
              disabled={isThinking}
            >
              {isVoiceActive ? (
                <IconMicrophoneOff size={22} />
              ) : (
                <IconMicrophone size={22} />
              )}
            </ActionIcon>

            {/* Send button */}
            <ActionIcon
              size="xl"
              radius="md"
              variant="filled"
              color="amber"
              onClick={handleSend}
              disabled={!inputValue.trim() || isThinking}
            >
              <IconSend size={22} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
    </Box>
  );
}

function EmptyState({ onSendMessage }: { onSendMessage: (msg: string) => void }) {
  return (
    <Box py={50} ta="center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Text size="xl" fw={700} c="white" mb="xs">
          Spatial Memory Assistant
        </Text>
        <Text size="sm" c="dimmed" mb={40} maw={400} mx="auto">
          I help you remember where you put your things. Ask me to find something or tell me where you're storing an item.
        </Text>
        
        <Stack gap="md" align="center" maw={400} mx="auto">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={1}>
            Quick Actions
          </Text>
          <Group gap="sm" justify="center">
            <QuickActionButton 
              label="Remember" 
              icon="📍" 
              onClick={() => onSendMessage("I want to remember where I put something")} 
            />
            <QuickActionButton 
              label="Find" 
              icon="🔍" 
              onClick={() => onSendMessage("Where did I put my...")} 
            />
            <QuickActionButton 
              label="List" 
              icon="📋" 
              onClick={() => onSendMessage("Show me what items I have stored")} 
            />
          </Group>
          
          <Divider variant="dotted" w="50%" label="or try" labelPosition="center" my="sm" />
          
          <Stack gap="xs" w="100%">
            <SuggestionChip 
              text="Where are my car keys?" 
              onClick={() => onSendMessage("Where are my car keys?")} 
            />
            <SuggestionChip 
              text="I put the passport in the blue folder" 
              onClick={() => onSendMessage("I put the passport in the blue folder")} 
            />
          </Stack>
        </Stack>
      </motion.div>
    </Box>
  );
}

function QuickActionButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <Button
      variant="light"
      color="gray"
      size="sm"
      radius="md"
      leftSection={<span>{icon}</span>}
      onClick={onClick}
      styles={{
        root: {
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.06)',
          },
        },
      }}
    >
      {label}
    </Button>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <Paper
      p="sm"
      px="md"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={onClick}
    >
      <Text size="sm" c="dimmed">
        "{text}"
      </Text>
    </Paper>
  );
}

const Divider = ({ ...props }: any) => (
  <Box 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      width: props.w || '100%',
      margin: `${props.my || 0}px 0`
    }}
  >
    <Box style={{ flex: 1, height: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
    {props.label && (
      <Text size="xs" c="dimmed" px="sm">{props.label}</Text>
    )}
    <Box style={{ flex: 1, height: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
  </Box>
);

