import { Box, Group, Text, Avatar, Paper, Stack, Badge, Loader } from '@mantine/core';
import { IconUser, IconRobot } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { Transcript, ToolCall, ToolResult } from '@/api/types';
import { GenerativeUI } from './GenerativeUI';

interface ChatMessageProps {
  transcript: Transcript;
  isStreaming?: boolean;
}

export function ChatMessage({ transcript, isStreaming }: ChatMessageProps) {
  const isUser = transcript.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Group
        align="flex-start"
        gap="sm"
        style={{
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <Avatar
          size={36}
          radius="xl"
          color={isUser ? 'blue' : 'amber'}
          style={{
            background: isUser
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          }}
        >
          {isUser ? <IconUser size={20} /> : <IconRobot size={20} />}
        </Avatar>

        <Stack gap="xs" style={{ flex: 1, maxWidth: '80%' }}>
          <Paper
            p="md"
            radius="lg"
            style={{
              background: isUser
                ? 'rgba(59, 130, 246, 0.15)'
                : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${
                isUser ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)'
              }`,
              marginLeft: isUser ? 'auto' : 0,
              marginRight: isUser ? 0 : 'auto',
            }}
          >
            <Text
              size="sm"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {transcript.text}
              {isStreaming && (
                <Box
                  component="span"
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    background: '#f59e0b',
                    marginLeft: 2,
                    animation: 'pulse 1s ease-in-out infinite',
                  }}
                />
              )}
            </Text>
          </Paper>

          {/* Tool calls and results */}
          {transcript.toolCalls && transcript.toolCalls.length > 0 && (
            <Stack gap="xs">
              {transcript.toolCalls.map((toolCall, i) => (
                <ToolCallDisplay key={i} toolCall={toolCall} />
              ))}
            </Stack>
          )}

          {transcript.toolResults && transcript.toolResults.length > 0 && (
            <Stack gap="xs">
              {transcript.toolResults.map((toolResult, i) => (
                <GenerativeUI key={i} toolResult={toolResult} />
              ))}
            </Stack>
          )}

          <Text size="xs" c="dimmed" ta={isUser ? 'right' : 'left'}>
            {transcript.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Stack>
      </Group>
    </motion.div>
  );
}

function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  return (
    <Paper
      p="xs"
      radius="md"
      style={{
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
      }}
    >
      <Group gap="xs">
        <Loader size="xs" color="violet" />
        <Badge size="sm" variant="light" color="violet">
          {toolCall.name}
        </Badge>
        <Text size="xs" c="dimmed">
          Processing...
        </Text>
      </Group>
    </Paper>
  );
}
