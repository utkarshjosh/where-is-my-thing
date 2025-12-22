import React, { useRef, useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Canvas, useFrame, extend, ReactThreeFiber } from '@react-three/fiber/native';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { Audio, useAudioRecorder } from 'expo-audio';

// --- Types & Interfaces ---
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface RingOrbProps {
    state?: OrbState;
    size?: number;
}

// --- Shader Definition ---
const RingShaderMaterial = shaderMaterial(
    {
        uTime: 0,
        uColor: new THREE.Color(0.0, 0.0, 0.0),
        uVolume: 0,
        uState: 0, // 0: idle, 1: listening, 2: thinking, 3: speaking
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment Shader
    `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uVolume;
    uniform float uState;
    varying vec2 vUv;

    void main() {
        // Center UV: -1 to 1
        vec2 uv = vUv * 2.0 - 1.0;
        float len = length(uv);
        float angle = atan(uv.y, uv.x);

        // --- Dynamics based on State ---
        // Idle: Slow breathing
        // Listening: User speaking -> High volume reactivity, "String" vibrates
        // Thinking: Fast rotation / swirling
        // Speaking: AI speaking -> Pulse

        float baseRadius = 0.35;
        float thickness = 0.005;
        
        // Modulate radius with volume (Expansion)
        float targetRadius = baseRadius + uVolume * 0.2;
        
        // "Vibration" - a high frequency perturbation
        // We compose multiple sine waves for a "string" look
        float vibration = 0.0;
        
        if (uState == 1.0) { // Listening
             vibration += sin(angle * 12.0 + uTime * 20.0) * 0.01 * (0.2 + uVolume * 3.0);
             vibration += sin(angle * 25.0 - uTime * 35.0) * 0.005 * (0.2 + uVolume * 3.0);
        } else if (uState == 2.0) { // Thinking
             vibration += sin(angle * 5.0 + uTime * 10.0) * 0.02; // Wobbly
        } else if (uState == 3.0) { // Speaking
             targetRadius += sin(uTime * 10.0) * 0.02; // Pulse
        }

        // Apply distortions
        float d = abs(len - (targetRadius + vibration));

        // --- Glow Calculation ---
        // "Blurry glow" = Inverse distance falloff
        // Neon style: 1 / x
        // We want it to look like light radiating
        
        float intensity = 0.0;
        
        // Core string (sharp)
        intensity += 0.002 / (d + 0.001);
        
        // Outer glow (blurry / radiating)
        // Modulate glow size with volume
        float glowSize = 0.05 + uVolume * 0.1;
        intensity += glowSize / (d + 0.05);

        // Falloff at edges of the quad
        float alpha = smoothstep(1.0, 0.8, len);
        
        // Final Color
        vec3 col = uColor * intensity;
        
        // Add a bit of "hot white" center to the string
        col += vec3(1.0) * smoothstep(0.02, 0.0, d) * 0.5;

        gl_FragColor = vec4(col, alpha * intensity); // Premultiplied-ish alpha for Additive
    }
    `
);

extend({ RingShaderMaterial });

// Declare definition for TypeScript
declare global {
    namespace JSX {
        interface IntrinsicElements {
            ringShaderMaterial: ReactThreeFiber.Object3DNode<THREE.ShaderMaterial, typeof RingShaderMaterial>;
        }
    }
}

const ORB_COLORS = {
    idle: '#8B5CF6',      // Violet
    listening: '#06B6D4', // Cyan
    thinking: '#10B981',  // Emerald
    speaking: '#EC4899',  // Pink
};

function Scene({ state, volume }: { state: OrbState; volume: number }) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const colorRef = useRef(new THREE.Color(ORB_COLORS.idle));
    const volumeRef = useRef(0);

    useFrame((stateCtx, delta) => {
        if (!materialRef.current) return;

        // Update Time
        materialRef.current.uniforms.uTime.value = stateCtx.clock.getElapsedTime();

        // Smoothly interpolate volume for visual stability
        volumeRef.current = THREE.MathUtils.lerp(volumeRef.current, volume, 0.2);
        materialRef.current.uniforms.uVolume.value = volumeRef.current;

        // Target Color
        const targetColor = new THREE.Color(ORB_COLORS[state]);
        colorRef.current.lerp(targetColor, 0.1);
        materialRef.current.uniforms.uColor.value = colorRef.current;

        // State Uniform
        let stateVal = 0;
        switch (state) {
            case 'idle': stateVal = 0; break;
            case 'listening': stateVal = 1; break;
            case 'thinking': stateVal = 2; break;
            case 'speaking': stateVal = 3; break;
        }
        materialRef.current.uniforms.uState.value = stateVal;
    });

    return (
        <mesh>
            <planeGeometry args={[2, 2]} />
            <ringShaderMaterial
                ref={materialRef}
                transparent={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </mesh>
    );
}

export function RingOrb({ state = 'idle', size }: RingOrbProps) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.8; // Slightly larger for 2D feel

    // Audio Metering
    const [volume, setVolume] = useState(0);

    // We only record when in 'listening' state to save battery/privacy
    // However, if the parent controls state based on its own logic, we might need to overlap
    // For now, we activate the hook; we must manually manage start/stop if we want to sync with state

    const recorder = useAudioRecorder(
        {
            isMeteringEnabled: true,
            extension: '.m4a',
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            android: {
                extension: '.m4a',
                outputFormat: 'mpeg4',
                audioEncoder: 'aac',
            },
            ios: {
                extension: '.m4a',
                audioQuality: 127,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
            web: {
                mimeType: 'audio/webm',
                bitsPerSecond: 128000,
            }
        },
        (status) => {
            // Cast to any because metering might be missing in strict types or optional
            const s = status as any;
            if (s.metering !== undefined) {
                // Metering is usually dB (-160 to 0)
                // Normalize to 0..1
                // -60dB (quiet) to 0dB (loud) is a good range
                const db = s.metering;
                const normalized = Math.max(0, (db + 60) / 60);
                setVolume(normalized);
            }
        }
    );

    // Effect to toggle recording based on state
    useEffect(() => {
        let isMounted = true;

        const manageRecording = async () => {
            // Request permissions first
            const permission = await Audio.requestRecordingPermissionsAsync();
            if (permission.status !== 'granted') return;

            if (state === 'listening' && !recorder.isRecording) {
                try {
                    await recorder.record();
                    console.log('Started metering recording');
                } catch (e) {
                    console.error('Failed to start recording', e);
                }
            } else if (state !== 'listening' && recorder.isRecording) {
                try {
                    await recorder.stop(); // Stop updates
                    console.log('Stopped metering recording');
                } catch (e) {
                    console.error('Failed to stop recording', e);
                }
            }
        };

        manageRecording();

        return () => {
            if (recorder.isRecording) {
                recorder.stop();
            }
        };
    }, [state, recorder]);

    // Fallback simulation if Volume is 0 but we are listening (maybe permissions failed or simulator)
    const displayVolume = useMemo(() => {
        // useMemo doesn't animate, but we pass raw volume to Scene which animates
        return volume;
    }, [volume]);

    // If not listening, force volume 0 to settle the orb
    const effectiveVolume = state === 'listening' ? volume : 0;
    // Add visual "noise" if listening but no volume detected (simulation fallback)
    // We can do this in the shader or here. Let's let the shader handle strict volume.

    return (
        <View style={{ width: orbSize, height: orbSize, alignItems: 'center', justifyContent: 'center' }}>
            <Canvas
                camera={{ position: [0, 0, 1], fov: 50 }} // Orthographic-ish setup
                style={{ flex: 1, backgroundColor: 'transparent' }}
                onCreated={(state) => {
                    // Force WebGL context to preserve drawing buffer if needed, but usually default is fine
                    state.gl.setClearColor(0x000000, 0);
                }}
            >
                <Scene state={state} volume={effectiveVolume} />
            </Canvas>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default RingOrb;
