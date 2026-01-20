/**
 * Chat Store using Zustand
 * Manages chat messages and voice agent state
 */

import { create } from 'zustand';
import type { Transcript, VoiceState, ToolCall, ToolResult } from '@/api/types';

interface ChatState {
  transcripts: Transcript[];
  voiceState: VoiceState;
  isConnected: boolean;
  error: Error | null;
  isVoiceMode: boolean;
  
  // Actions
  addTranscript: (transcript: Omit<Transcript, 'id' | 'timestamp'>) => void;
  updateLastTranscript: (text: string) => void;
  addToolCall: (toolCall: ToolCall) => void;
  addToolResult: (toolResult: ToolResult) => void;
  setVoiceState: (state: VoiceState) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: Error | null) => void;
  setVoiceMode: (voiceMode: boolean) => void;
  clearTranscripts: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  transcripts: [],
  voiceState: 'idle',
  isConnected: false,
  error: null,
  isVoiceMode: false,

  addTranscript: (transcript) =>
    set((state) => ({
      transcripts: [
        ...state.transcripts,
        {
          ...transcript,
          id: Date.now().toString(),
          timestamp: new Date(),
        },
      ],
    })),

  updateLastTranscript: (text) =>
    set((state) => {
      const transcripts = [...state.transcripts];
      if (transcripts.length > 0) {
        const last = transcripts[transcripts.length - 1];
        transcripts[transcripts.length - 1] = { ...last, text };
      }
      return { transcripts };
    }),

  addToolCall: (toolCall) =>
    set((state) => {
      const transcripts = [...state.transcripts];
      if (transcripts.length > 0) {
        const last = transcripts[transcripts.length - 1];
        transcripts[transcripts.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls || []), toolCall],
        };
      }
      return { transcripts };
    }),

  addToolResult: (toolResult) =>
    set((state) => {
      const transcripts = [...state.transcripts];
      if (transcripts.length > 0) {
        const last = transcripts[transcripts.length - 1];
        transcripts[transcripts.length - 1] = {
          ...last,
          toolResults: [...(last.toolResults || []), toolResult],
        };
      }
      return { transcripts };
    }),

  setVoiceState: (voiceState) => set({ voiceState }),
  setConnected: (isConnected) => set({ isConnected }),
  setError: (error) => set({ error }),
  setVoiceMode: (isVoiceMode) => set({ isVoiceMode }),
  clearTranscripts: () => set({ transcripts: [] }),
}));
