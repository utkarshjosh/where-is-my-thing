/**
 * useVoiceAgent - React hook for real-time voice interaction with the spatial memory agent
 * 
 * Connects to backend WebSocket for bidirectional audio streaming using ADK BIDI mode.
 */
import { apiClient } from '@/services/api';
import { useAuth } from '@clerk/clerk-expo';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface Transcript {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
}

export interface ToolResult {
    name: string;
    result: unknown;
}

interface UseVoiceAgentOptions {
    onTranscript?: (transcript: Transcript) => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (toolResult: ToolResult) => void;
    onError?: (error: Error) => void;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
    const { getToken } = useAuth();
    const [state, setState] = useState<VoiceState>('idle');
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const audioPlayerRef = useRef<Audio.Sound | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const isRecordingRef = useRef(false);
    const isStartingRecordingRef = useRef(false);

    // Connect to WebSocket
    const connect = useCallback(async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            setState('connecting');
            setError(null);

            const token = await getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const wsUrl = apiClient.getVoiceWebSocketUrl(token);
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setIsConnected(true);
                setState('idle');
                console.log('Voice WebSocket connected');
            };

            ws.onmessage = async (event) => {
                try {
                    const message = JSON.parse(event.data);

                    switch (message.type) {
                        case 'transcript':
                            const transcript: Transcript = {
                                id: Date.now().toString(),
                                role: message.role,
                                text: message.text,
                                timestamp: new Date(),
                            };
                            setTranscripts(prev => [...prev, transcript]);
                            options.onTranscript?.(transcript);

                            if (message.role === 'assistant') {
                                setState('speaking');
                            }
                            break;

                        case 'audio':
                            // Queue audio for playback (play immediately)
                            audioQueueRef.current.push(message.data);
                            playNextAudio();
                            break;

                        case 'interrupt':
                            // Stop AI audio playback when user interrupts
                            stopAudioPlayback();
                            break;

                        case 'tool_call':
                            setState('thinking');
                            options.onToolCall?.({
                                name: message.name,
                                args: message.args,
                            });
                            break;

                        case 'tool_result':
                            options.onToolResult?.({
                                name: message.name,
                                result: message.result,
                            });
                            break;

                        case 'turn_complete':
                            setState('idle');
                            break;

                        case 'error':
                            const err = new Error(message.message);
                            setError(err);
                            setState('error');
                            options.onError?.(err);
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError(new Error('WebSocket connection error'));
                setState('error');
            };

            ws.onclose = () => {
                setIsConnected(false);
                setState('idle');
                console.log('Voice WebSocket closed');
            };

            wsRef.current = ws;
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to connect');
            setError(err);
            setState('error');
            options.onError?.(err);
        }
    }, [getToken, options]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setState('idle');
    }, []);

    // Stop current audio playback and clear queue
    const stopAudioPlayback = useCallback(async () => {
        if (audioPlayerRef.current) {
            try {
                await audioPlayerRef.current.stopAsync();
                await audioPlayerRef.current.unloadAsync();
                audioPlayerRef.current = null;
            } catch (e) {
                console.error('Error stopping audio:', e);
            }
        }
        audioQueueRef.current = [];
        isPlayingRef.current = false;
    }, []);

    // Play queued audio with increased speed
    const playNextAudio = useCallback(async () => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) {
            return;
        }

        isPlayingRef.current = true;
        const audioData = audioQueueRef.current.shift();

        if (audioData) {
            try {
                // Decode base64 to audio
                // Note: In a real implementation, you'd need to handle PCM audio
                // This is a simplified version
                const { sound } = await Audio.Sound.createAsync(
                    { uri: `data:audio/wav;base64,${audioData}` },
                    { 
                        shouldPlay: true,
                        rate: 1.25, // Increase playback speed by 25% for faster response
                        shouldCorrectPitch: true, // Maintain pitch when speeding up
                    }
                );

                audioPlayerRef.current = sound;

                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        sound.unloadAsync();
                        isPlayingRef.current = false;
                        audioPlayerRef.current = null;
                        playNextAudio();
                    }
                });
            } catch (e) {
                console.error('Error playing audio:', e);
                isPlayingRef.current = false;
                audioPlayerRef.current = null;
                playNextAudio();
            }
        }
    }, [stopAudioPlayback]);

    // Start recording
    const startListening = useCallback(async () => {
        // Prevent multiple simultaneous calls
        if (isStartingRecordingRef.current) {
            console.log('Recording already starting, skipping...');
            return;
        }

        // Check if already recording
        if (isRecordingRef.current && recordingRef.current) {
            // Double-check by verifying recording status
            try {
                const status = await recordingRef.current.getStatusAsync();
                if (status.isRecording || status.isDoneRecording === false) {
                    console.log('Recording already in progress, skipping...');
                    return;
                }
            } catch (e) {
                // If status check fails, assume recording is not active and continue
                console.log('Status check failed, cleaning up stale recording ref');
                recordingRef.current = null;
                isRecordingRef.current = false;
            }
        }

        // Check state to avoid starting if already listening
        if (state === 'listening') {
            console.log('Already listening, skipping...');
            return;
        }

        if (!isConnected) {
            await connect();
        }

        isStartingRecordingRef.current = true;

        try {
            // Stop any ongoing AI audio playback when user starts speaking
            stopAudioPlayback();

            // Request permissions
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                throw new Error('Microphone permission required');
            }

            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Check again after async operations (race condition protection)
            if (isRecordingRef.current && recordingRef.current) {
                try {
                    const status = await recordingRef.current.getStatusAsync();
                    if (status.isRecording || status.isDoneRecording === false) {
                        console.log('Recording started during async operations, skipping...');
                        isStartingRecordingRef.current = false;
                        return;
                    }
                } catch (e) {
                    // If status check fails, assume recording is not active and continue
                    console.log('Status check failed during async operations, cleaning up stale recording ref');
                    recordingRef.current = null;
                    isRecordingRef.current = false;
                }
            }

            // Start recording
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({
                isMeteringEnabled: true,
                android: {
                    extension: '.pcm',
                    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
                    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.pcm',
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            });

            await recording.startAsync();
            recordingRef.current = recording;
            isRecordingRef.current = true;
            setState('listening');

            // Set up periodic audio sending (every 100ms)
            const sendAudioInterval = setInterval(async () => {
                if (recordingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                    // Note: expo-audio doesn't support streaming chunks directly
                    // In a production app, you'd use a native module for real-time audio
                    // For now, we'll send audio when recording stops
                }
            }, 100);

            // Store interval for cleanup
            (recording as any)._sendInterval = sendAudioInterval;
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to start recording');
            setError(err);
            setState('error');
            options.onError?.(err);
            // Clean up on error
            recordingRef.current = null;
            isRecordingRef.current = false;
        } finally {
            isStartingRecordingRef.current = false;
        }
    }, [isConnected, connect, options, stopAudioPlayback, state]);

    // Stop recording and send audio
    const stopListening = useCallback(async () => {
        if (!recordingRef.current || !isRecordingRef.current) {
            return;
        }

        try {
            setState('thinking');
            isRecordingRef.current = false;

            // Clear send interval
            const interval = (recordingRef.current as any)._sendInterval;
            if (interval) {
                clearInterval(interval);
            }

            // Stop recording
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
                // Read file and send as base64
                const response = await fetch(uri);
                const blob = await response.blob();
                const reader = new FileReader();

                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    wsRef.current?.send(JSON.stringify({
                        type: 'audio',
                        data: base64,
                    }));
                    wsRef.current?.send(JSON.stringify({
                        type: 'end_turn',
                    }));
                };

                reader.readAsDataURL(blob);
            }
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Failed to stop recording');
            setError(err);
            setState('error');
            options.onError?.(err);
            // Clean up on error
            recordingRef.current = null;
            isRecordingRef.current = false;
        }
    }, [options]);

    // Send text message
    const sendMessage = useCallback(async (text: string) => {
        if (!isConnected) {
            await connect();
        }

        // Stop any ongoing AI audio playback when user sends a message
        stopAudioPlayback();

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'text',
                data: text,
            }));
            wsRef.current.send(JSON.stringify({
                type: 'end_turn',
            }));

            // Add user transcript
            const transcript: Transcript = {
                id: Date.now().toString(),
                role: 'user',
                text,
                timestamp: new Date(),
            };
            setTranscripts(prev => [...prev, transcript]);
            options.onTranscript?.(transcript);

            setState('thinking');
        }
    }, [isConnected, connect, options, stopAudioPlayback]);

    // Clear transcripts
    const clearTranscripts = useCallback(() => {
        setTranscripts([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(console.error);
                recordingRef.current = null;
            }
            isRecordingRef.current = false;
            isStartingRecordingRef.current = false;
            if (audioPlayerRef.current) {
                audioPlayerRef.current.unloadAsync();
            }
        };
    }, [disconnect]);

    return {
        state,
        isConnected,
        transcripts,
        error,
        connect,
        disconnect,
        startListening,
        stopListening,
        sendMessage,
        clearTranscripts,
    };
}
