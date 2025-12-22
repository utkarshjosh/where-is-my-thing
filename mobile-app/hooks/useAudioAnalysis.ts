/**
 * useAudioAnalysis - Hook for real-time audio metering
 * Provides amplitude data for the AI orb visualization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

export interface AudioAnalysisData {
    amplitude: number;  // 0-1 normalized amplitude
    bass: number;       // Low frequency energy (simulated)
    mid: number;        // Mid frequency (simulated)
    treble: number;     // High frequency (simulated)
    isActive: boolean;
}

const defaultAudioData: AudioAnalysisData = {
    amplitude: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    isActive: false,
};

/**
 * Hook for audio analysis
 * Note: Full FFT analysis requires native modules or Web Audio API
 * This provides amplitude-based analysis with simulated frequency bands
 */
export function useAudioAnalysis(): AudioAnalysisData & {
    startAnalysis: () => void;
    stopAnalysis: () => void;
    simulateAmplitude: (value: number) => void;
} {
    const [audioData, setAudioData] = useState<AudioAnalysisData>(defaultAudioData);
    const animationRef = useRef<number | null>(null);
    const simulatedAmplitudeRef = useRef<number>(0);

    // Simulate amplitude for testing and state-driven animation
    const simulateAmplitude = useCallback((value: number) => {
        simulatedAmplitudeRef.current = Math.max(0, Math.min(1, value));
    }, []);

    // Generate pseudo-frequency bands from amplitude
    const generateFrequencyBands = useCallback((amplitude: number) => {
        // Simulate frequency bands with slight variations
        const time = Date.now() / 1000;
        const bass = amplitude * (0.8 + Math.sin(time * 2) * 0.2);
        const mid = amplitude * (0.6 + Math.sin(time * 3) * 0.3);
        const treble = amplitude * (0.4 + Math.sin(time * 5) * 0.4);

        return { bass, mid, treble };
    }, []);

    const startAnalysis = useCallback(() => {
        if (animationRef.current) return;

        const animate = () => {
            const amplitude = simulatedAmplitudeRef.current;
            const { bass, mid, treble } = generateFrequencyBands(amplitude);

            setAudioData({
                amplitude,
                bass,
                mid,
                treble,
                isActive: true,
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
    }, [generateFrequencyBands]);

    const stopAnalysis = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        setAudioData(defaultAudioData);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return {
        ...audioData,
        startAnalysis,
        stopAnalysis,
        simulateAmplitude,
    };
}

/**
 * Hook for state-based amplitude simulation
 * Generates dynamic amplitude based on orb state
 */
export function useStateBasedAmplitude(state: 'idle' | 'listening' | 'thinking' | 'speaking') {
    const [amplitude, setAmplitude] = useState(0);
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        startTimeRef.current = Date.now();

        const animate = () => {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            let newAmplitude = 0;

            switch (state) {
                case 'idle':
                    // Gentle breathing: 0.1-0.2 range
                    newAmplitude = 0.15 + Math.sin(elapsed * 0.8) * 0.05;
                    break;
                case 'listening':
                    // Active listening: 0.3-0.6 range with faster pulses
                    newAmplitude = 0.45 + Math.sin(elapsed * 3) * 0.15;
                    break;
                case 'thinking':
                    // Processing: 0.4-0.7 range with irregular pattern
                    newAmplitude = 0.55 + Math.sin(elapsed * 2) * 0.1 + Math.sin(elapsed * 5) * 0.05;
                    break;
                case 'speaking':
                    // Speaking: 0.5-0.9 range with natural speech-like rhythm
                    newAmplitude = 0.7 + Math.sin(elapsed * 8) * 0.15 + Math.sin(elapsed * 3) * 0.05;
                    break;
            }

            setAmplitude(Math.max(0, Math.min(1, newAmplitude)));
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [state]);

    return amplitude;
}

export default useAudioAnalysis;
