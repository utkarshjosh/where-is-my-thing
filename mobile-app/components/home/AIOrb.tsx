/**
 * AIOrb - Advanced organic morphing orb using WebGL
 * Features: Perlin noise vertex displacement, dynamic colors, audio-reactive effects
 * Inspired by AnimateReactNative and Siri orb animations
 */

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, Text } from 'react-native';
import * as THREE from 'three';

import theme from '@/constants/theme';
import { orbVertexShader, orbFragmentShader, stateToNumber, statePalettes } from './shaders/OrbShader';
import { useStateBasedAmplitude } from '@/hooks/useAudioAnalysis';

// Platform-specific Canvas import
// Web uses @react-three/fiber, native uses @react-three/fiber/native
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

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AIOrbProps {
    state?: OrbState;
    size?: number;
}

// Custom shader material for the morphing orb
function MorphingOrbMesh({ state, amplitude }: { state: OrbState; amplitude: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // Create shader material with uniforms
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uState: { value: 0 },
        uColor1: { value: new THREE.Vector3(0.55, 0.36, 0.91) },
        uColor2: { value: new THREE.Vector3(0.65, 0.36, 0.96) },
        uColor3: { value: new THREE.Vector3(0.45, 0.26, 0.81) },
    }), []);

    // Update state and colors when state changes
    useEffect(() => {
        if (materialRef.current) {
            const stateNum = stateToNumber(state);
            materialRef.current.uniforms.uState.value = stateNum;

            // Update color palette for current state
            const palette = statePalettes[state];
            materialRef.current.uniforms.uColor1.value.set(...palette.color1);
            materialRef.current.uniforms.uColor2.value.set(...palette.color2);
            materialRef.current.uniforms.uColor3.value.set(...palette.color3);
        }
    }, [state]);

    // Animation loop - this is where the magic happens
    useFrame((frameState: any, delta: number) => {
        if (materialRef.current) {
            // Update time - this drives all animations
            materialRef.current.uniforms.uTime.value += delta;

            // Smooth amplitude transition for natural feel
            const currentAmp = materialRef.current.uniforms.uAmplitude.value;
            const targetAmp = amplitude;
            materialRef.current.uniforms.uAmplitude.value = THREE.MathUtils.lerp(currentAmp, targetAmp, 0.1);

            // Generate frequency bands from amplitude with variation
            const time = materialRef.current.uniforms.uTime.value;
            const amp = materialRef.current.uniforms.uAmplitude.value;

            // Different frequencies with phase offsets for organic feel
            materialRef.current.uniforms.uBass.value = amp * (0.7 + Math.sin(time * 2.0) * 0.3);
            materialRef.current.uniforms.uMid.value = amp * (0.5 + Math.sin(time * 3.0 + 1.0) * 0.4);
            materialRef.current.uniforms.uTreble.value = amp * (0.3 + Math.sin(time * 5.0 + 2.0) * 0.5);
        }

        // Subtle rotation for dynamic feel
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.1;
            meshRef.current.rotation.x += delta * 0.05;
        }
    });

    return (
        <mesh ref={meshRef}>
            {/* IcosahedronGeometry is preferred for blob-like morphing effects */}
            <icosahedronGeometry args={[1, 4]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={orbVertexShader}
                fragmentShader={orbFragmentShader}
                uniforms={uniforms}
                transparent={true}
                side={THREE.FrontSide}
                depthWrite={true}
            />
        </mesh>
    );
}

// Outer glow effect using Three.js mesh instead of CSS
function OuterGlow({ state, amplitude }: { state: OrbState; amplitude: number }) {
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((frameState: any) => {
        if (glowRef.current && glowRef.current.material) {
            const time = frameState.clock.elapsedTime;

            // Pulsing scale based on state
            let pulseSpeed = 1.0;
            let pulseAmp = 0.05;
            if (state === 'listening') { pulseSpeed = 2.0; pulseAmp = 0.08; }
            if (state === 'thinking') { pulseSpeed = 3.0; pulseAmp = 0.1; }
            if (state === 'speaking') { pulseSpeed = 5.0; pulseAmp = 0.15; }

            const scale = 1.4 + Math.sin(time * pulseSpeed) * pulseAmp * amplitude;
            glowRef.current.scale.setScalar(scale);

            // Animate opacity
            const mat = glowRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.15 + amplitude * 0.1 + Math.sin(time * pulseSpeed) * 0.05;
        }
    });

    // Get color based on state
    const glowColor = useMemo(() => {
        const palette = statePalettes[state];
        return new THREE.Color(palette.color1[0], palette.color1[1], palette.color1[2]);
    }, [state]);

    return (
        <mesh ref={glowRef}>
            <icosahedronGeometry args={[1, 2]} />
            <meshBasicMaterial
                color={glowColor}
                transparent={true}
                opacity={0.2}
                side={THREE.BackSide}
            />
        </mesh>
    );
}

// Inner core glow for depth
function InnerCore() {
    const coreRef = useRef<THREE.Mesh>(null);

    useFrame((frameState: any) => {
        if (coreRef.current) {
            const time = frameState.clock.elapsedTime;
            // Subtle pulsing
            const scale = 0.4 + Math.sin(time * 2.0) * 0.02;
            coreRef.current.scale.setScalar(scale);
        }
    });

    return (
        <mesh ref={coreRef}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial
                color={new THREE.Color(1, 1, 1)}
                transparent={true}
                opacity={0.3}
            />
        </mesh>
    );
}

// Camera positioning
function CameraSetup() {
    const { camera } = useThree();

    useEffect(() => {
        camera.position.set(0, 0, 3.5);
        camera.lookAt(0, 0, 0);
    }, [camera]);

    return null;
}

// Main Three.js scene
function OrbScene({ state }: { state: OrbState }) {
    const amplitude = useStateBasedAmplitude(state);

    return (
        <>
            <CameraSetup />
            {/* Ambient + point lights for depth */}
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
            <pointLight position={[-5, -5, 5]} intensity={0.5} color="#8B5CF6" />
            <pointLight position={[0, 0, -5]} intensity={0.3} color="#06B6D4" />

            {/* Glow layers */}
            <OuterGlow state={state} amplitude={amplitude} />
            <InnerCore />

            {/* Main morphing orb */}
            <MorphingOrbMesh state={state} amplitude={amplitude} />
        </>
    );
}

// Fallback component while loading
function FallbackOrb({ size }: { size: number }) {
    return (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={styles.fallbackText}>Loading...</Text>
        </View>
    );
}

// Main exported component
export function AIOrb({ state = 'idle', size }: AIOrbProps) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.6;

    return (
        <View style={[styles.container, { width: orbSize, height: orbSize }]}>
            <Suspense fallback={<FallbackOrb size={orbSize} />}>
                <Canvas
                    style={{ flex: 1 }}
                    gl={{ antialias: true, alpha: true }}
                    onCreated={(glState: any) => {
                        // Transparent background
                        glState.gl.setClearColor(0x000000, 0);
                    }}
                >
                    <OrbScene state={state} />
                </Canvas>
            </Suspense>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallback: {
        backgroundColor: theme.colors.primary.base,
        opacity: 0.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackText: {
        color: 'white',
        fontSize: 12,
    },
});

export default AIOrb;
