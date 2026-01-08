import React, { useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { useStateBasedAmplitude } from '@/hooks/useAudioAnalysis';

// Platform-specific Canvas import
let Canvas: any;
let useFrame: any;
let useThree: any;

if (Platform.OS === 'web') {
    const r3f = require('@react-three/fiber');
    Canvas = r3f.Canvas;
    useFrame = r3f.useFrame;
    useThree = r3f.useThree;
} else {
    const r3fNative = require('@react-three/fiber/native');
    Canvas = r3fNative.Canvas;
    useFrame = r3fNative.useFrame;
    useThree = r3fNative.useThree;
}

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
        uAspect: 1.0, // Aspect ratio to maintain circular shape
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
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
        // Center UV: -1 to 1, adjust for aspect ratio to maintain circular shape
        vec2 uv = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
        float len = length(uv);
        float angle = atan(uv.y, uv.x);

        float baseRadius = 0.35;
        
        // Modulate radius with volume (Expansion)
        float targetRadius = baseRadius + uVolume * 0.2;
        
        // "Vibration" - a high frequency perturbation
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
        float intensity = 0.0;
        
        // Core string (sharp)
        intensity += 0.002 / (d + 0.001);
        
        // Outer glow
        float glowSize = 0.03 + uVolume * 0.06;
        intensity += glowSize / (d + 0.05);

        // Fade at edges to prevent harsh clipping
        float edgeFade = smoothstep(0.5, 0.4, len);
        float alpha = intensity * edgeFade;
        
        // Final Color
        vec3 col = uColor * intensity;
        
        // Add a bit of "hot white" center
        col += vec3(1.0) * smoothstep(0.02, 0.0, d) * 0.5;

        gl_FragColor = vec4(col, alpha);
    }
    `
);

if (Platform.OS === 'web') {
    const { extend } = require('@react-three/fiber');
    extend({ RingShaderMaterial });
} else {
    const { extend } = require('@react-three/fiber/native');
    extend({ RingShaderMaterial });
}

const ORB_COLORS = {
    idle: '#8B5CF6',      // Violet
    listening: '#06B6D4', // Cyan
    thinking: '#10B981',  // Emerald
    speaking: '#EC4899',  // Pink
};

function Scene({ state, volume, aspect }: { state: OrbState; volume: number; aspect: number }) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const colorRef = useRef(new THREE.Color(ORB_COLORS.idle));
    const volumeRef = useRef(0);
    
    // Get camera from Three.js context
    const { camera } = useThree();

    useFrame((stateCtx: any) => {
        if (!materialRef.current) return;

        materialRef.current.uniforms.uTime.value = stateCtx.clock.getElapsedTime();
        materialRef.current.uniforms.uAspect.value = aspect;

        // Smoothly interpolate volume
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
            {/* @ts-ignore */}
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
    const orbSize = size || screenWidth * 0.55;
    const aspect = 1.0; // Square aspect for contained orb

    // Use simulated volume for reliability
    const volume = useStateBasedAmplitude(state);

    return (
        <View 
            style={{ 
                width: orbSize,
                height: orbSize,
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 1], fov: 50 }}
                style={{ 
                    width: orbSize, 
                    height: orbSize, 
                    backgroundColor: 'transparent' 
                }}
                onCreated={(state: any) => {
                    state.gl.setClearColor(0x000000, 0);
                }}
            >
                <Scene state={state} volume={volume} aspect={aspect} />
            </Canvas>
        </View>
    );
}

export default RingOrb;
