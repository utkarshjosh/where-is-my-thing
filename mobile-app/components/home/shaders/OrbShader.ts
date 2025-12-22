/**
 * Advanced Orb Shader - Organic morphing blob with Perlin noise
 * Simplified version for web + mobile compatibility
 */

// Perlin noise helper functions (Ashima's webgl-noise - simplified)
const noiseHelpers = /* glsl */ `
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 10.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// 3D Perlin noise with periodic boundaries
float pnoise(vec3 P, vec3 rep) {
    vec3 Pi0 = mod(floor(P), rep);
    vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
    vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
    vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
    vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
    vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;

    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}
`;

export const orbVertexShader = /* glsl */ `
${noiseHelpers}

uniform float uTime;
uniform float uAmplitude;
uniform float uBass;
uniform int uState;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
varying float vNoiseValue;

void main() {
    vUv = uv;
    
    // Time-based animation speed varies by state
    float timeScale = 0.3;
    if (uState == 1) timeScale = 0.5;
    if (uState == 2) timeScale = 0.7;
    if (uState == 3) timeScale = 1.0;
    
    float animTime = uTime * timeScale;
    
    // Organic morphing with Perlin noise layers
    float noise1 = pnoise(position * 1.5 + animTime, vec3(10.0));
    float noise2 = pnoise(position * 3.0 - animTime * 1.3, vec3(10.0)) * 0.5;
    float noise3 = pnoise(position * 6.0 + animTime * 2.0, vec3(10.0)) * 0.25;
    
    float combinedNoise = noise1 + noise2 + noise3;
    vNoiseValue = combinedNoise;
    
    // Audio reactive displacement
    float audioBoost = 1.0 + uAmplitude * 2.0;
    float bassEffect = uBass * sin(position.y * 4.0 + animTime) * 0.15;
    
    float totalDisplacement = (combinedNoise * 0.3 + bassEffect) * audioBoost;
    
    // State multiplier
    float stateMultiplier = 1.0;
    if (uState == 1) stateMultiplier = 1.2;
    if (uState == 2) stateMultiplier = 1.5;
    if (uState == 3) stateMultiplier = 1.8 + sin(animTime * 10.0) * 0.3;
    
    totalDisplacement *= stateMultiplier;
    vDisplacement = totalDisplacement;
    
    // Apply displacement along normal
    vec3 newPosition = position + normal * totalDisplacement;
    vPosition = newPosition;
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

export const orbFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;
uniform int uState;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
varying float vNoiseValue;

void main() {
    // Dynamic color based on state
    vec3 color1, color2, color3;
    
    if (uState == 0) {
        color1 = vec3(0.55, 0.36, 0.91);
        color2 = vec3(0.65, 0.36, 0.96);
        color3 = vec3(0.45, 0.26, 0.81);
    } else if (uState == 1) {
        color1 = vec3(0.0, 0.8, 0.95);
        color2 = vec3(0.2, 0.6, 1.0);
        color3 = vec3(0.1, 0.4, 0.9);
    } else if (uState == 2) {
        color1 = vec3(0.0, 0.9, 0.7);
        color2 = vec3(0.2, 0.8, 0.5);
        color3 = vec3(0.0, 0.7, 0.9);
    } else {
        color1 = vec3(1.0, 0.3, 0.7);
        color2 = vec3(0.9, 0.2, 0.9);
        color3 = vec3(1.0, 0.5, 0.5);
    }
    
    // Color mixing based on displacement and noise
    float colorMix = clamp((vDisplacement + 0.5) * 0.5 + sin(uTime * 0.5) * 0.2, 0.0, 1.0);
    vec3 baseColor = mix(color1, color2, colorMix);
    baseColor = mix(baseColor, color3, vNoiseValue * 0.5 + 0.5);
    
    // Fresnel glow
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);
    vec3 fresnelColor = mix(baseColor, vec3(1.0), 0.5);
    
    // Glow intensity
    float glowIntensity = 0.3 + uAmplitude * 0.7;
    float pulseGlow = 1.0;
    if (uState > 0) {
        float pulseSpeed = 2.0 + float(uState) * 2.0;
        pulseGlow = 1.0 + sin(uTime * pulseSpeed) * 0.3 * uAmplitude;
    }
    
    // Iridescent effect
    float iridescence = sin(vNoiseValue * 10.0 + uTime) * 0.1;
    vec3 finalColor = baseColor;
    finalColor.r += iridescence;
    finalColor.b -= iridescence * 0.5;
    
    // Combine effects
    finalColor += fresnelColor * fresnel * glowIntensity * pulseGlow;
    
    // Inner glow
    float innerGlow = smoothstep(-0.2, 0.3, vDisplacement) * 0.4;
    finalColor += baseColor * innerGlow;
    
    // Speaking brightness boost
    if (uState == 3) {
        finalColor += vec3(1.0) * (0.2 + sin(uTime * 12.0) * 0.1 * uAmplitude);
    }
    
    float alpha = 0.85 + fresnel * 0.15;
    gl_FragColor = vec4(finalColor, alpha);
}
`;

// Default shader uniforms
export const defaultOrbUniforms = {
    uTime: { value: 0 },
    uAmplitude: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uState: { value: 0 },
    uColor1: { value: [0.55, 0.36, 0.91] },
    uColor2: { value: [0.65, 0.36, 0.96] },
    uColor3: { value: [0.45, 0.26, 0.81] },
};

// State number mapping
export const stateToNumber = (state: 'idle' | 'listening' | 'thinking' | 'speaking'): number => {
    switch (state) {
        case 'idle': return 0;
        case 'listening': return 1;
        case 'thinking': return 2;
        case 'speaking': return 3;
        default: return 0;
    }
};

// Color palettes for each state
export const statePalettes = {
    idle: {
        color1: [0.55, 0.36, 0.91] as [number, number, number],
        color2: [0.65, 0.36, 0.96] as [number, number, number],
        color3: [0.45, 0.26, 0.81] as [number, number, number],
    },
    listening: {
        color1: [0.0, 0.8, 0.95] as [number, number, number],
        color2: [0.2, 0.6, 1.0] as [number, number, number],
        color3: [0.1, 0.4, 0.9] as [number, number, number],
    },
    thinking: {
        color1: [0.0, 0.9, 0.7] as [number, number, number],
        color2: [0.2, 0.8, 0.5] as [number, number, number],
        color3: [0.0, 0.7, 0.9] as [number, number, number],
    },
    speaking: {
        color1: [1.0, 0.3, 0.7] as [number, number, number],
        color2: [0.9, 0.2, 0.9] as [number, number, number],
        color3: [1.0, 0.5, 0.5] as [number, number, number],
    },
};
