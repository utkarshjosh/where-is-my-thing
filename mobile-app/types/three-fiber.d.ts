/// <reference types="@react-three/fiber" />

// This file declares global JSX types for React Three Fiber
// It allows TypeScript to recognize Three.js elements like <mesh>, <sphereGeometry>, etc.

import { ThreeElements } from '@react-three/fiber';

declare global {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements { }
    }
}

export { };
