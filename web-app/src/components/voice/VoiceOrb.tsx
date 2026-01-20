import { useState, useCallback } from 'react';
import { Box, Text, Stack, Tooltip, ActionIcon } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import { IconMicrophone, IconMicrophoneOff, IconX } from '@tabler/icons-react';
import type { VoiceState } from '@/api/types';

interface VoiceOrbProps {
  state: VoiceState;
  onPressStart: () => void;
  onPressEnd: () => void;
  onClose?: () => void;
  size?: number;
  minimized?: boolean;
}

const stateColors = {
  idle: '#f59e0b',
  connecting: '#8b5cf6',
  listening: '#3b82f6',
  thinking: '#8b5cf6',
  speaking: '#10b981',
  error: '#ef4444',
};

const stateLabels = {
  idle: 'Hold to speak',
  connecting: 'Connecting...',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error',
};

export function VoiceOrb({
  state,
  onPressStart,
  onPressEnd,
  onClose,
  size = 120,
  minimized = false,
}: VoiceOrbProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = useCallback(() => {
    setIsPressed(true);
    onPressStart();
  }, [onPressStart]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    onPressEnd();
  }, [onPressEnd]);

  const color = stateColors[state];
  const label = stateLabels[state];
  const isActive = state !== 'idle' && state !== 'error';

  if (minimized) {
    return (
      <Tooltip label={label} position="left">
        <ActionIcon
          size="xl"
          radius="xl"
          variant="filled"
          color="amber"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
            boxShadow: isActive ? `0 0 20px ${color}50` : undefined,
          }}
        >
          <IconMicrophone size={24} />
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Stack align="center" gap="md">
      {/* Close button */}
      {onClose && (
        <Box style={{ position: 'absolute', top: -40, right: -40 }}>
          <ActionIcon
            size="sm"
            radius="xl"
            variant="subtle"
            color="gray"
            onClick={onClose}
          >
            <IconX size={16} />
          </ActionIcon>
        </Box>
      )}

      {/* Orb container */}
      <Box
        style={{
          position: 'relative',
          width: size,
          height: size,
          cursor: 'pointer',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Outer glow rings */}
        <AnimatePresence>
          {isActive && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 0, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: 'easeInOut',
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `2px solid ${color}`,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Main orb */}
        <motion.div
          animate={{
            scale: isPressed ? 0.95 : 1,
            boxShadow: isActive
              ? `0 0 40px ${color}60, 0 0 80px ${color}30`
              : `0 0 20px ${color}30`,
          }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `
              radial-gradient(circle at 30% 30%, ${color}40 0%, transparent 50%),
              radial-gradient(circle at 70% 70%, ${color}20 0%, transparent 50%),
              linear-gradient(135deg, ${color} 0%, ${color}aa 100%)
            `,
            border: `2px solid ${color}80`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner content */}
          <motion.div
            animate={{
              rotate: state === 'thinking' ? 360 : 0,
            }}
            transition={{
              duration: 2,
              repeat: state === 'thinking' ? Infinity : 0,
              ease: 'linear',
            }}
          >
            {state === 'error' ? (
              <IconMicrophoneOff size={size * 0.3} color="white" />
            ) : (
              <IconMicrophone size={size * 0.3} color="white" />
            )}
          </motion.div>
        </motion.div>

        {/* Listening indicator - audio visualization bars */}
        {state === 'listening' && (
          <Box
            style={{
              position: 'absolute',
              bottom: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 3,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{
                  height: [8, 20, 8],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut',
                }}
                style={{
                  width: 4,
                  background: color,
                  borderRadius: 2,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* State label */}
      <Text
        size="sm"
        c="dimmed"
        fw={500}
        style={{
          opacity: 0.8,
        }}
      >
        {label}
      </Text>
    </Stack>
  );
}

// Floating orb variant for bottom-right corner
export function FloatingVoiceOrb({
  state,
  onPressStart,
  onPressEnd,
  isExpanded,
  onToggleExpand,
}: {
  state: VoiceState;
  onPressStart: () => void;
  onPressEnd: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const color = stateColors[state];
  const isActive = state !== 'idle' && state !== 'error';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
      }}
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box
              p="lg"
              style={{
                background: 'rgba(15, 15, 15, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                position: 'relative',
              }}
            >
              <VoiceOrb
                state={state}
                onPressStart={onPressStart}
                onPressEnd={onPressEnd}
                onClose={onToggleExpand}
                size={100}
              />
            </Box>
          </motion.div>
        ) : (
          <motion.div
            key="minimized"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Tooltip label={stateLabels[state]} position="left">
              <Box
                onClick={onToggleExpand}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                  boxShadow: isActive
                    ? `0 0 30px ${color}50, 0 4px 20px rgba(0,0,0,0.3)`
                    : '0 4px 20px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <IconMicrophone size={24} color="white" />

                {/* Active pulse */}
                {isActive && (
                  <motion.div
                    animate={{
                      scale: [1, 1.5],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: `2px solid ${color}`,
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
