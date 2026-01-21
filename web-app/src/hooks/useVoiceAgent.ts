/**
 * useVoiceAgent - React hook for real-time voice interaction with the spatial memory agent
 *
 * Connects to backend WebSocket for bidirectional audio streaming using Web Audio API.
 * Uses a singleton WebSocket manager to ensure only one connection exists at a time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiClient } from '@/api/client';
import { useRateLimitStore } from '@/stores/rateLimitStore';
import { useChatStore } from '@/stores/chatStore';
import type { VoiceState, ToolCall, ToolResult, WebSocketMessage } from '@/api/types';

interface UseVoiceAgentOptions {
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolResult: ToolResult) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

// Subscriber interface for WebSocket events
interface WebSocketSubscriber {
  onMessage: (message: WebSocketMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: Error) => void;
}

// Singleton WebSocket Manager
class VoiceWebSocketManager {
  private static instance: VoiceWebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private subscribers = new Set<WebSocketSubscriber>();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isIntentionallyClosed = false;
  private getTokenFn: (() => Promise<string | null>) | null = null;
  private connectingPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): VoiceWebSocketManager {
    if (!VoiceWebSocketManager.instance) {
      VoiceWebSocketManager.instance = new VoiceWebSocketManager();
    }
    return VoiceWebSocketManager.instance;
  }

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getTokenFn = getter;
  }

  subscribe(subscriber: WebSocketSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
      // Close connection if no subscribers left
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  private notifySubscribers(event: keyof Omit<WebSocketSubscriber, 'onMessage'>, ...args: any[]) {
    this.subscribers.forEach((subscriber) => {
      if (event === 'onConnect') {
        subscriber.onConnect();
      } else if (event === 'onDisconnect') {
        subscriber.onDisconnect();
      } else if (event === 'onError') {
        subscriber.onError(args[0]);
      }
    });
  }

  private notifyMessage(message: WebSocketMessage) {
    this.subscribers.forEach((subscriber) => {
      subscriber.onMessage(message);
    });
  }

  async connect(): Promise<void> {
    // If already connected, return immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.notifySubscribers('onConnect');
      return;
    }

    // If already connecting, wait for the existing connection attempt
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    // If there's a connecting socket, wait for it
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            this.notifySubscribers('onConnect');
            resolve();
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            clearInterval(checkInterval);
            // Connection failed, will retry
            reject(new Error('Connection failed'));
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout'));
        }, 5000);
      });
    }

    if (!this.getTokenFn) {
      throw new Error('Token getter not set');
    }

    this.isIntentionallyClosed = false;
    this.clearReconnectTimeout();

    // Create a promise that tracks this connection attempt
    this.connectingPromise = (async () => {
      try {
        const token = await this.getTokenFn();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const wsUrl = apiClient.getVoiceWebSocketUrl(token);
        const ws = new WebSocket(wsUrl);

        // Set ws immediately to prevent concurrent connection attempts
        this.ws = ws;

        ws.onopen = () => {
          console.log('Voice WebSocket connected');
          this.reconnectAttempts = 0;
          this.connectingPromise = null;
          this.notifySubscribers('onConnect');
        };

        ws.onmessage = async (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.notifyMessage(message);
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket error:', event);
          const error = new Error('WebSocket connection error');
          this.notifySubscribers('onError', error);
          // Don't reconnect immediately on error, let onclose handle it
        };

        ws.onclose = () => {
          console.log('Voice WebSocket closed');
          this.ws = null;
          this.connectingPromise = null;
          this.notifySubscribers('onDisconnect');

          // Reconnect if not intentionally closed and we have subscribers
          if (!this.isIntentionallyClosed && this.subscribers.size > 0) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.ws = null;
        this.connectingPromise = null;
        const err = error instanceof Error ? error : new Error('Failed to connect');
        this.notifySubscribers('onError', err);
        this.scheduleReconnect();
        throw err;
      }
    })();

    return this.connectingPromise;
  }

  private scheduleReconnect() {
    if (this.isIntentionallyClosed || this.subscribers.size === 0) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifySubscribers('onError', new Error('Max reconnection attempts reached'));
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
    const totalDelay = delay + jitter;

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${Math.round(totalDelay)}ms`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, totalDelay);
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.clearReconnectTimeout();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string | object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    }
    return false;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const { getToken } = useAuth();
  const wsManagerRef = useRef<VoiceWebSocketManager | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const {
    addTranscript,
    addToolCall,
    addToolResult,
    setVoiceState,
    setConnected,
    setError,
    voiceState,
    isConnected,
    error,
  } = useChatStore();

  // Track connection state from manager
  const [managerConnected, setManagerConnected] = useState(false);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Process queued audio
  const processAudioQueue = useCallback(async (audioContext: AudioContext) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const arrayBuffer = audioQueueRef.current.shift();

    if (arrayBuffer) {
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = 1.25; // Speed up playback slightly
        source.connect(audioContext.destination);

        source.onended = () => {
          isPlayingRef.current = false;
          processAudioQueue(audioContext);
        };

        source.start();
      } catch (e) {
        console.error('Error decoding audio:', e);
        isPlayingRef.current = false;
        processAudioQueue(audioContext);
      }
    }
  }, []);

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      const audioContext = initAudioContext();

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Queue the audio
      audioQueueRef.current.push(arrayBuffer);
      processAudioQueue(audioContext);
    } catch (e) {
      console.error('Error playing audio:', e);
    }
  }, [initAudioContext, processAudioQueue]);

  // Stop audio playback
  const stopAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // Initialize WebSocket manager singleton
  useEffect(() => {
    const manager = VoiceWebSocketManager.getInstance();
    manager.setTokenGetter(getToken);
    wsManagerRef.current = manager;
  }, [getToken]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const manager = wsManagerRef.current;
    if (!manager) return;

    // Initialize state
    setManagerConnected(manager.isConnected);

    const unsubscribe = manager.subscribe({
      onMessage: (message: WebSocketMessage) => {
        switch (message.type) {
          case 'transcript':
            // Only add assistant transcripts from WebSocket - user transcripts are added locally when sending
            if (message.role === 'assistant') {
              addTranscript({
                role: message.role,
                text: message.text,
              });
              optionsRef.current.onTranscript?.(message.role, message.text);
              setVoiceState('speaking');
            }
            break;

          case 'audio':
            // Play audio response
            playAudio(message.data);
            break;

          case 'interrupt':
            // Stop AI audio playback when user interrupts
            stopAudioPlayback();
            break;

          case 'tool_call':
            setVoiceState('thinking');
            const toolCall: ToolCall = {
              name: message.name,
              args: message.args,
            };
            addToolCall(toolCall);
            optionsRef.current.onToolCall?.(toolCall);
            break;

          case 'tool_result':
            const toolResult: ToolResult = {
              name: message.name,
              result: message.result,
            };
            addToolResult(toolResult);
            optionsRef.current.onToolResult?.(toolResult);
            break;

          case 'turn_complete':
            setVoiceState('idle');
            break;

          case 'error': {
            const err = new Error(message.message);
            const lowerMessage = message.message?.toLowerCase?.() ?? '';
            if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
              useRateLimitStore.getState().setRateLimit(60, message.message);
            }
            setError(err);
            setVoiceState('error');
            optionsRef.current.onError?.(err);
            break;
          }
        }
      },
      onConnect: () => {
        setManagerConnected(true);
        setConnected(true);
        setVoiceState('idle');
      },
      onDisconnect: () => {
        setManagerConnected(false);
        setConnected(false);
        setVoiceState('idle');
      },
      onError: (err: Error) => {
        setError(err);
        setVoiceState('error');
        optionsRef.current.onError?.(err);
      },
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [getToken, addTranscript, addToolCall, addToolResult, setVoiceState, setConnected, setError, playAudio, stopAudioPlayback]);

  // Connect to WebSocket via singleton manager
  const connect = useCallback(async () => {
    const manager = wsManagerRef.current;
    if (!manager) {
      return;
    }

    // If already connected, return immediately
    if (manager.isConnected) {
      return;
    }

    // If already connecting, return immediately (don't call connect again)
    if (manager.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      setVoiceState('connecting');
      setError(null);
      await manager.connect();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to connect');
      setError(err);
      setVoiceState('error');
      optionsRef.current.onError?.(err);
    }
  }, [setVoiceState, setError]);

  // Disconnect from WebSocket (only disconnects if no other subscribers)
  const disconnect = useCallback(() => {
    // Note: The manager will automatically disconnect when all subscribers unsubscribe
    // This is handled in the useEffect cleanup. We don't need to explicitly disconnect here
    // unless we want to force disconnect even if there are other subscribers.
    // For now, we'll let the cleanup handle it.
  }, []);

  // Get current connection state from manager
  const getIsConnected = useCallback(() => {
    return wsManagerRef.current?.isConnected ?? false;
  }, []);

  // Start recording
  const startListening = useCallback(async () => {
    if (voiceState === 'listening') {
      return;
    }

    const manager = wsManagerRef.current;
    if (!manager?.isConnected) {
      await connect();
    }

    try {
      // Stop any ongoing AI audio playback
      stopAudioPlayback();

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser');
      }

      // Request microphone permission with fallback constraints
      let stream: MediaStream;
      try {
        // Try with preferred constraints first
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (e) {
        // Fallback to basic audio constraints if preferred ones fail
        console.warn('Failed with preferred audio constraints, trying basic constraints:', e);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }

      // Clear previous chunks
      audioChunksRef.current = [];

      // Create media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setVoiceState('listening');
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to start recording');
      setError(err);
      setVoiceState('error');
      optionsRef.current.onError?.(err);
    }
  }, [connect, voiceState, setVoiceState, setError, stopAudioPlayback]);

  // Stop recording and send audio
  const stopListening = useCallback(async () => {
    if (!mediaRecorderRef.current || voiceState !== 'listening') {
      return;
    }

    try {
      setVoiceState('thinking');

      // Stop recording
      const mediaRecorder = mediaRecorderRef.current;
      const stream = mediaRecorder.stream;

      // Wait for the last data
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      // Stop all tracks
      stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;

      // Combine audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];

      const manager = wsManagerRef.current;
      if (audioBlob.size > 0 && manager?.isConnected) {
        // Convert to base64 and send
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          manager.send({
            type: 'audio',
            data: base64,
          });
          manager.send({
            type: 'end_turn',
          });
        };
        reader.readAsDataURL(audioBlob);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to stop recording');
      setError(err);
      setVoiceState('error');
      optionsRef.current.onError?.(err);
    }
  }, [voiceState, setVoiceState, setError]);

  // Send text message
  const sendMessage = useCallback(
    async (text: string) => {
      const manager = wsManagerRef.current;
      if (!manager?.isConnected) {
        await connect();
      }

      // Stop any ongoing AI audio playback
      stopAudioPlayback();

      if (manager?.isConnected) {
        // Add user transcript locally
        addTranscript({
          role: 'user',
          text,
        });

        manager.send({
          type: 'text',
          data: text,
        });
        manager.send({
          type: 'end_turn',
        });

        setVoiceState('thinking');
      }
    },
    [connect, addTranscript, setVoiceState, stopAudioPlayback]
  );

  // Auto-connect on mount if option is set
  useEffect(() => {
    if (!options.autoConnect) {
      return;
    }

    let mounted = true;
    let timeoutId: number | null = null;

    // Small delay to prevent double connection in React StrictMode
    timeoutId = window.setTimeout(() => {
      if (mounted) {
        connect();
      }
    }, 0);

    return () => {
      mounted = false;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
    // Cleanup is handled by the manager subscription unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.autoConnect]); // Only depend on autoConnect

  // Use manager connection state (synced via subscription callbacks)
  return {
    voiceState,
    isConnected: managerConnected,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendMessage,
  };
}
