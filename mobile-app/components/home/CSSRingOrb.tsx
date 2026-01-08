import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface CSSRingOrbProps {
    state?: OrbState;
    size?: number;
}

const ORB_COLORS = {
    idle: '#8B5CF6',      // Violet
    listening: '#06B6D4', // Cyan
    thinking: '#10B981',  // Emerald
    speaking: '#EC4899',  // Pink
};

export function CSSRingOrb({ state = 'idle', size }: CSSRingOrbProps) {
    const { width: screenWidth } = useWindowDimensions();
    const orbSize = size || screenWidth * 0.55;
    const containerRef = useRef<View>(null);
    const currentColor = ORB_COLORS[state];

    // Inject CSS keyframes and styles for web
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const styleId = 'css-ring-orb-styles';
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            :root {
                --orb-color: ${currentColor};
                --orb-size: ${orbSize}px;
            }

            @keyframes breathe {
                0%, 100% { 
                    transform: scale3d(1, 1, 1);
                }
                50% { 
                    transform: scale3d(1.03, 1.03, 1);
                }
            }

            @keyframes heartbeat {
                0%, 100% { 
                    transform: scale3d(1, 1, 1);
                }
                8% { 
                    transform: scale3d(1.18, 1.18, 1);
                }
                16% { 
                    transform: scale3d(1.05, 1.05, 1);
                }
                24% { 
                    transform: scale3d(1.15, 1.15, 1);
                }
                32% { 
                    transform: scale3d(1, 1, 1);
                }
            }

            @keyframes wiggle {
                0%, 100% { 
                    transform: scale3d(1, 1, 1) rotate(0deg);
                    border-radius: 50%;
                }
                12.5% { 
                    transform: scale3d(1.02, 0.98, 1) rotate(2deg);
                    border-radius: 52% 48% 48% 52%;
                }
                25% { 
                    transform: scale3d(0.98, 1.02, 1) rotate(-2deg);
                    border-radius: 48% 52% 52% 48%;
                }
                37.5% { 
                    transform: scale3d(1.02, 0.98, 1) rotate(2deg);
                    border-radius: 52% 48% 48% 52%;
                }
                50% { 
                    transform: scale3d(1, 1, 1) rotate(0deg);
                    border-radius: 50%;
                }
                62.5% { 
                    transform: scale3d(0.98, 1.02, 1) rotate(-2deg);
                    border-radius: 48% 52% 52% 48%;
                }
                75% { 
                    transform: scale3d(1.02, 0.98, 1) rotate(2deg);
                    border-radius: 52% 48% 48% 52%;
                }
                87.5% { 
                    transform: scale3d(0.98, 1.02, 1) rotate(-2deg);
                    border-radius: 48% 52% 52% 48%;
                }
            }

            @keyframes highlightDrift {
                0% { 
                    transform: rotate(0deg) translate3d(0, 0, 0);
                    opacity: 0.9;
                }
                25% {
                    opacity: 0.7;
                }
                50% { 
                    transform: rotate(180deg) translate3d(0, 0, 0);
                    opacity: 0.5;
                }
                75% {
                    opacity: 0.7;
                }
                100% { 
                    transform: rotate(360deg) translate3d(0, 0, 0);
                    opacity: 0.9;
                }
            }

            @keyframes highlightDrift2 {
                0% { 
                    transform: rotate(180deg) translate3d(0, 0, 0);
                    opacity: 0.6;
                }
                50% { 
                    transform: rotate(360deg) translate3d(0, 0, 0);
                    opacity: 0.4;
                }
                100% { 
                    transform: rotate(540deg) translate3d(0, 0, 0);
                    opacity: 0.6;
                }
            }

            @keyframes pulseGlow {
                0%, 100% { 
                    opacity: 0.5;
                    transform: scale3d(1, 1, 1);
                }
                50% { 
                    opacity: 0.8;
                    transform: scale3d(1.05, 1.05, 1);
                }
            }

            @keyframes innerGlow {
                0%, 100% { 
                    opacity: 0.3;
                }
                50% { 
                    opacity: 0.6;
                }
            }

            .css-ring-orb-container {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                contain: layout style paint;
                backface-visibility: hidden;
                transform: translateZ(0);
            }

            .css-ring-orb-outer-glow {
                position: absolute;
                border-radius: 50%;
                will-change: transform, opacity;
                animation: breathe 4s ease-in-out infinite, pulseGlow 3s ease-in-out infinite;
                transform: translateZ(0);
            }

            .css-ring-orb-ring-container {
                position: relative;
                width: 100%;
                height: 100%;
                will-change: transform;
                transform: translateZ(0);
                animation: breathe 4s ease-in-out infinite;
            }

            .css-ring-orb-ring-container.state-listening {
                animation: breathe 4s ease-in-out infinite, heartbeat 1.2s ease-in-out infinite, wiggle 2s ease-in-out infinite;
            }

            .css-ring-orb-ring-container.state-thinking {
                animation: breathe 4s ease-in-out infinite, wiggle 3s ease-in-out infinite;
            }

            .css-ring-orb-ring-container.state-speaking {
                animation: breathe 4s ease-in-out infinite, heartbeat 0.8s ease-in-out infinite;
            }

            .css-ring-orb-ring {
                will-change: transform;
                transform: translateZ(0);
            }

            .css-ring-orb-ring-inner {
                will-change: opacity;
                animation: innerGlow 2s ease-in-out infinite;
            }

            .css-ring-orb-highlight {
                position: absolute;
                will-change: transform, opacity;
                transform: translateZ(0);
                animation: highlightDrift 10s linear infinite;
                pointer-events: none;
            }

            .css-ring-orb-highlight-2 {
                position: absolute;
                will-change: transform, opacity;
                transform: translateZ(0);
                animation: highlightDrift2 12s linear infinite;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);

        return () => {
            const styleToRemove = document.getElementById(styleId);
            if (styleToRemove) {
                styleToRemove.remove();
            }
        };
    }, [state, orbSize, currentColor]);

    const stateClass = `state-${state}`;

    // Calculate ring dimensions
    const ringThickness = orbSize * 0.08;
    const ringOuterRadius = orbSize * 0.5;
    const ringInnerRadius = ringOuterRadius - ringThickness;
    const ringCenter = orbSize * 0.5;

    // Convert color to RGB for opacity variations
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 139, g: 92, b: 246 };
    };
    const rgb = hexToRgb(currentColor);

    // For web, we'll use inline styles with CSS classes
    // For native, we'll use StyleSheet (fallback)
    const webStyles = Platform.OS === 'web' ? {
        container: {
            width: orbSize,
            height: orbSize,
        },
        // Outer glow layers (multiple for depth)
        outerGlow1: {
            position: 'absolute' as const,
            width: orbSize * 1.4,
            height: orbSize * 1.4,
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3) 0%, transparent 60%)`,
            filter: `blur(${orbSize * 0.2}px)`,
        },
        outerGlow2: {
            position: 'absolute' as const,
            width: orbSize * 1.2,
            height: orbSize * 1.2,
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 0%, transparent 70%)`,
            filter: `blur(${orbSize * 0.15}px)`,
        },
        ringContainer: {
            width: orbSize,
            height: orbSize,
            position: 'relative' as const,
        },
        // Main ring with multiple shadow layers for depth
        ring: {
            position: 'absolute' as const,
            width: ringOuterRadius * 2,
            height: ringOuterRadius * 2,
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
            borderRadius: '50%',
            border: `${ringThickness}px solid ${currentColor}`,
            boxShadow: `
                inset 0 0 ${ringThickness * 3}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8),
                inset 0 0 ${ringThickness * 6}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4),
                0 0 ${ringThickness * 2}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9),
                0 0 ${ringThickness * 4}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7),
                0 0 ${ringThickness * 8}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5),
                0 0 ${ringThickness * 12}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3),
                0 0 ${ringThickness * 20}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)
            `,
        },
        // Inner ring layer for depth
        ringInner: {
            position: 'absolute' as const,
            width: ringInnerRadius * 2,
            height: ringInnerRadius * 2,
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1), transparent 80%)`,
            boxShadow: `inset 0 0 ${ringThickness * 4}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
        },
        // Core highlight spot
        coreHighlight: {
            position: 'absolute' as const,
            width: ringThickness * 4,
            height: ringThickness * 4,
            left: '50%',
            top: '50%',
            transform: 'translate3d(-50%, -50%, 0)',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255, 255, 255, 0.4), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), transparent)`,
            filter: `blur(${ringThickness * 0.5}px)`,
        },
        // Rotating highlight - primary
        highlight: {
            position: 'absolute' as const,
            width: ringThickness * 4,
            height: ringThickness * 2,
            left: '50%',
            top: '50%',
            transformOrigin: '0 0',
            transform: `translate3d(-50%, -50%, 0) rotate(0deg) translate3d(${ringOuterRadius - ringThickness * 0.3}px, 0, 0)`,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), transparent)`,
            filter: `blur(${ringThickness * 0.4}px)`,
        },
        // Rotating highlight - secondary (white)
        highlight2: {
            position: 'absolute' as const,
            width: ringThickness * 3,
            height: ringThickness * 1.5,
            left: '50%',
            top: '50%',
            transformOrigin: '0 0',
            transform: `translate3d(-50%, -50%, 0) rotate(180deg) translate3d(${ringOuterRadius - ringThickness * 0.2}px, 0, 0)`,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.3), transparent)`,
            filter: `blur(${ringThickness * 0.3}px)`,
        },
    } : {};

    if (Platform.OS === 'web') {
        return (
            <View 
                ref={containerRef}
                style={[styles.container, { width: orbSize, height: orbSize }]}
                // @ts-ignore - web-only className
                className="css-ring-orb-container"
            >
                {/* Outer glow layers for depth */}
                <View
                    style={[webStyles.outerGlow1]}
                    // @ts-ignore - web-only className
                    className="css-ring-orb-outer-glow"
                />
                <View
                    style={[webStyles.outerGlow2]}
                    // @ts-ignore - web-only className
                    className="css-ring-orb-outer-glow"
                />

                {/* Main ring container */}
                <View
                    style={[webStyles.ringContainer]}
                    // @ts-ignore - web-only className
                    className={`css-ring-orb-ring-container ${stateClass}`}
                >
                    {/* Main ring with glow */}
                    <View 
                        style={[webStyles.ring]}
                        // @ts-ignore - web-only className
                        className="css-ring-orb-ring"
                    />
                    
                    {/* Inner glow layer */}
                    <View 
                        style={[webStyles.ringInner]}
                        // @ts-ignore - web-only className
                        className="css-ring-orb-ring-inner"
                    />

                    {/* Core highlight */}
                    <View style={[webStyles.coreHighlight]} />

                    {/* Rotating highlight - primary */}
                    <View
                        style={[webStyles.highlight]}
                        // @ts-ignore - web-only className
                        className="css-ring-orb-highlight"
                    />

                    {/* Rotating highlight - secondary */}
                    <View
                        style={[webStyles.highlight2]}
                        // @ts-ignore - web-only className
                        className="css-ring-orb-highlight-2"
                    />
                </View>
            </View>
        );
    }

    // Fallback for native platforms (simplified version)
    return (
        <View style={[styles.container, { width: orbSize, height: orbSize }]}>
            <View style={[styles.ring, { 
                width: ringOuterRadius * 2, 
                height: ringOuterRadius * 2,
                borderRadius: ringOuterRadius,
                borderWidth: ringThickness,
                borderColor: currentColor,
            }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
    },
});

export default CSSRingOrb;

