import React, { useRef, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    PanResponder,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

import theme, { categories, CategoryKey } from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { useGraph } from '@/hooks/useGraph';
import { GraphNode, GraphEdge } from '@/services/api';

// Delay before refetching when page comes into focus (in milliseconds)
const REFETCH_DELAY = 1000; // 1 second delay

// Helper to compute node positions using force-directed layout simulation
function computeNodePositions(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    if (nodes.length === 0) return positions;

    // Initialize positions in a circle
    nodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / nodes.length;
        const radius = 0.35;
        positions.set(node.id, {
            x: 0.5 + radius * Math.cos(angle),
            y: 0.5 + radius * Math.sin(angle),
        });
    });

    // Simple force simulation (a few iterations)
    for (let iteration = 0; iteration < 50; iteration++) {
        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const posI = positions.get(nodes[i].id)!;
                const posJ = positions.get(nodes[j].id)!;

                const dx = posJ.x - posI.x;
                const dy = posJ.y - posI.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

                const repulsion = 0.01 / (dist * dist);
                const fx = (dx / dist) * repulsion;
                const fy = (dy / dist) * repulsion;

                positions.set(nodes[i].id, { x: posI.x - fx, y: posI.y - fy });
                positions.set(nodes[j].id, { x: posJ.x + fx, y: posJ.y + fy });
            }
        }

        // Attraction along edges
        edges.forEach(edge => {
            const posSource = positions.get(edge.source);
            const posTarget = positions.get(edge.target);

            if (posSource && posTarget) {
                const dx = posTarget.x - posSource.x;
                const dy = posTarget.y - posSource.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

                const attraction = dist * 0.1;
                const fx = (dx / dist) * attraction;
                const fy = (dy / dist) * attraction;

                positions.set(edge.source, { x: posSource.x + fx * 0.5, y: posSource.y + fy * 0.5 });
                positions.set(edge.target, { x: posTarget.x - fx * 0.5, y: posTarget.y - fy * 0.5 });
            }
        });

        // Keep nodes within bounds
        positions.forEach((pos, id) => {
            pos.x = Math.max(0.1, Math.min(0.9, pos.x));
            pos.y = Math.max(0.1, Math.min(0.9, pos.y));
            positions.set(id, pos);
        });
    }

    return positions;
}

export default function GraphScreen() {
    const { width: windowWidth } = useWindowDimensions();
    const { nodes, edges, isLoading, error, refresh, fetchGraph } = useGraph({ autoFetch: false });
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [refreshing, setRefreshing] = useState(false);
    const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

    const graphSize = Math.max(240, Math.min(windowWidth - theme.spacing.md * 2, 520));

    // Lazy refetch when page comes into focus with delay
    useFocusEffect(
        React.useCallback(() => {
            // Clear any existing timer
            if (refetchTimerRef.current) {
                clearTimeout(refetchTimerRef.current);
            }

            // Schedule refetch after delay
            refetchTimerRef.current = setTimeout(() => {
                // Fetch graph data when screen comes into focus (lazy refetch)
                // This will use cached data if available and valid, or fetch if needed
                fetchGraph();
            }, REFETCH_DELAY);

            // Cleanup timer on unmount or when leaving focus
            return () => {
                if (refetchTimerRef.current) {
                    clearTimeout(refetchTimerRef.current);
                    refetchTimerRef.current = null;
                }
            };
        }, [fetchGraph])
    );

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    // PanResponder only works on native platforms, not on web
    const panResponder = useRef(
        Platform.OS !== 'web'
            ? PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderMove: (_, gestureState) => {
                      translateX.value = gestureState.dx;
                      translateY.value = gestureState.dy;
                  },
                  onPanResponderRelease: () => {
                      translateX.value = withSpring(0);
                      translateY.value = withSpring(0);
                  },
              })
            : null
    ).current;

    const webPanHandlers = Platform.OS === 'web'
        ? {
              onStartShouldSetResponder: () => true,
              onMoveShouldSetResponder: () => true,
              onResponderGrant: (event: any) => {
                  const { pageX, pageY } = event.nativeEvent;
                  lastPointerRef.current = { x: pageX, y: pageY };
              },
              onResponderMove: (event: any) => {
                  if (!lastPointerRef.current) return;
                  const { pageX, pageY } = event.nativeEvent;
                  const dx = pageX - lastPointerRef.current.x;
                  const dy = pageY - lastPointerRef.current.y;
                  translateX.value = translateX.value + dx;
                  translateY.value = translateY.value + dy;
                  lastPointerRef.current = { x: pageX, y: pageY };
              },
              onResponderRelease: () => {
                  lastPointerRef.current = null;
                  translateX.value = withSpring(0);
                  translateY.value = withSpring(0);
              },
              onResponderTerminate: () => {
                  lastPointerRef.current = null;
                  translateX.value = withSpring(0);
                  translateY.value = withSpring(0);
              },
          }
        : {};

    const graphStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale },
        ],
    }));

    // Compute node positions
    const nodePositions = useMemo(() => computeNodePositions(nodes, edges), [nodes, edges]);

    const handleNodePress = (nodeId: string) => {
        setSelectedNode(selectedNode === nodeId ? null : nodeId);
    };

    const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2));
    const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
    const handleReset = () => {
        setScale(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    // Get node position in pixels
    const getNodePosition = (nodeId: string) => {
        const pos = nodePositions.get(nodeId);
        if (!pos) return { x: graphSize / 2, y: graphSize / 2 };
        return {
            x: pos.x * graphSize,
            y: pos.y * graphSize,
        };
    };

    // Check if edge is connected to selected node
    const isEdgeHighlighted = (edge: GraphEdge) => {
        return selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
    };

    // Get category color
    const getCategoryColor = (category: string | null): string => {
        if (!category) return theme.colors.primary.base;
        return (categories as Record<string, { color: string }>)[category]?.color || theme.colors.primary.base;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Memory Graph</Text>
                <Text style={styles.subtitle}>
                    {isLoading ? 'Loading...' : `${nodes.length} nodes, ${edges.length} connections`}
                </Text>
            </View>

            {/* Error State */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={24} color={theme.colors.error} />
                    <Text style={styles.errorText}>{error.message}</Text>
                </View>
            )}

            {/* Graph Container */}
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary.base}
                    />
                }
            >
                <View style={[styles.graphWrapper, { minHeight: graphSize + 40 }]}>
                    <GlassContainer style={[styles.graphContainer, { minHeight: graphSize }]}>
                        {isLoading && nodes.length === 0 ? (
                            <View style={[styles.loadingContainer, { minHeight: graphSize }]}>
                                <ActivityIndicator size="large" color={theme.colors.primary.base} />
                                <Text style={styles.loadingText}>Loading graph...</Text>
                            </View>
                        ) : nodes.length === 0 ? (
                            <View style={[styles.emptyContainer, { minHeight: graphSize }]}>
                                <Ionicons name="git-network-outline" size={48} color={theme.colors.text.muted} />
                                <Text style={styles.emptyText}>No data yet</Text>
                                <Text style={styles.emptySubtext}>
                                    Start by telling the voice assistant where you put things
                                </Text>
                            </View>
                        ) : (
                            <Animated.View
                                {...(panResponder?.panHandlers || {})}
                                {...webPanHandlers}
                                style={[styles.graph, { width: graphSize, height: graphSize }, graphStyle]}
                            >
                                <Svg width={graphSize} height={graphSize}>
                                    <Defs>
                                        <RadialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
                                            <Stop offset="0%" stopColor={theme.colors.primary.light} stopOpacity="0.8" />
                                            <Stop offset="100%" stopColor={theme.colors.primary.dark} stopOpacity="0.6" />
                                        </RadialGradient>
                                    </Defs>

                                    {/* Edges */}
                                    {edges.map((edge, index) => {
                                        const from = getNodePosition(edge.source);
                                        const to = getNodePosition(edge.target);
                                        const highlighted = isEdgeHighlighted(edge);

                                        return (
                                            <Line
                                                key={`edge-${index}`}
                                                x1={from.x}
                                                y1={from.y}
                                                x2={to.x}
                                                y2={to.y}
                                                stroke={highlighted ? theme.colors.primary.base : theme.colors.glass.border}
                                                strokeWidth={highlighted ? 2 : 1}
                                                strokeOpacity={highlighted ? 0.8 : 0.4}
                                            />
                                        );
                                    })}

                                    {/* Nodes */}
                                    {nodes.map((node) => {
                                        const pos = getNodePosition(node.id);
                                        const categoryColor = getCategoryColor(node.category);
                                        const isSelected = selectedNode === node.id;
                                        const isConnected =
                                            selectedNode &&
                                            edges.some(
                                                (e) =>
                                                    (e.source === selectedNode && e.target === node.id) ||
                                                    (e.target === selectedNode && e.source === node.id)
                                            );

                                        return (
                                            <Circle
                                                key={node.id}
                                                cx={pos.x}
                                                cy={pos.y}
                                                r={isSelected ? 28 : isConnected ? 24 : 20}
                                                fill={categoryColor}
                                                fillOpacity={isSelected || isConnected ? 0.8 : 0.5}
                                                stroke={isSelected ? '#fff' : categoryColor}
                                                strokeWidth={isSelected ? 3 : 1}
                                                onPress={() => handleNodePress(node.id)}
                                            />
                                        );
                                    })}
                                </Svg>

                                {/* Node Labels */}
                                {nodes.map((node) => {
                                    const pos = getNodePosition(node.id);
                                    const isSelected = selectedNode === node.id;

                                    return (
                                        <TouchableOpacity
                                            key={`label-${node.id}`}
                                            style={[
                                                styles.nodeLabel,
                                                {
                                                    left: pos.x - 30,
                                                    top: pos.y + (isSelected ? 32 : 24),
                                                },
                                            ]}
                                            onPress={() => handleNodePress(node.id)}
                                        >
                                            <Text
                                                style={[
                                                    styles.nodeLabelText,
                                                    isSelected && styles.nodeLabelTextSelected,
                                                ]}
                                            >
                                                {node.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </Animated.View>
                        )}
                    </GlassContainer>

                    {/* Zoom Controls */}
                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.controlButton} onPress={handleZoomIn}>
                            <Ionicons name="add" size={24} color={theme.colors.text.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlButton} onPress={handleZoomOut}>
                            <Ionicons name="remove" size={24} color={theme.colors.text.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
                            <Ionicons name="locate" size={20} color={theme.colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Selected Node Info */}
                {selectedNode && (
                    <View style={styles.infoPanel}>
                        <GlassContainer style={styles.infoContainer}>
                            {(() => {
                                const node = nodes.find((n) => n.id === selectedNode);
                                if (!node) return null;
                                const connections = edges.filter(
                                    (e) => e.source === selectedNode || e.target === selectedNode
                                ).length;
                                const categoryInfo = node.category ? (categories as Record<string, { icon: string; label: string; color: string }>)[node.category] : null;

                                return (
                                    <>
                                        <View style={styles.infoHeader}>
                                            <View
                                                style={[
                                                    styles.infoBadge,
                                                    { backgroundColor: (categoryInfo?.color || theme.colors.primary.base) + '30' },
                                                ]}
                                            >
                                                <Ionicons
                                                    name={(categoryInfo?.icon || 'cube-outline') as any}
                                                    size={20}
                                                    color={categoryInfo?.color || theme.colors.primary.base}
                                                />
                                            </View>
                                            <View style={styles.infoText}>
                                                <Text style={styles.infoTitle}>{node.label}</Text>
                                                <Text style={styles.infoSubtitle}>
                                                    {node.type} • {categoryInfo?.label || node.category || 'Unknown'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.infoStats}>
                                            <Text style={styles.infoStat}>
                                                <Text style={styles.infoStatValue}>{connections}</Text> connections
                                            </Text>
                                        </View>
                                    </>
                                );
                            })()}
                        </GlassContainer>
                    </View>
                )}

                {/* Legend */}
                <View style={styles.legend}>
                    <Text style={styles.legendTitle}>Legend</Text>
                    <View style={styles.legendItems}>
                        {(Object.keys(categories) as CategoryKey[]).slice(0, 4).map((key) => (
                            <View key={key} style={styles.legendItem}>
                                <View
                                    style={[
                                        styles.legendDot,
                                        { backgroundColor: categories[key].color },
                                    ]}
                                />
                                <Text style={styles.legendLabel}>{categories[key].label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Bottom padding */}
                <View style={styles.bottomPadding} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    header: {
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
    },
    title: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes['2xl'],
        fontWeight: theme.typography.weights.bold,
    },
    subtitle: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
        marginTop: 2,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        marginHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: theme.typography.sizes.sm,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'stretch',
    },
    graphWrapper: {
        flex: 1,
        padding: theme.spacing.md,
        position: 'relative',
        alignItems: 'center',
    },
    graphContainer: {
        flex: 1,
        overflow: 'hidden',
        width: '100%',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: theme.colors.text.muted,
        marginTop: theme.spacing.md,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
    },
    emptyText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.medium,
        marginTop: theme.spacing.md,
    },
    emptySubtext: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
    },
    graph: {
        position: 'relative',
    },
    nodeLabel: {
        position: 'absolute',
        width: 60,
        alignItems: 'center',
    },
    nodeLabelText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.xs,
        textAlign: 'center',
    },
    nodeLabelTextSelected: {
        color: theme.colors.text.primary,
        fontWeight: theme.typography.weights.semibold,
    },
    controls: {
        position: 'absolute',
        right: theme.spacing.lg,
        top: theme.spacing.lg,
        gap: theme.spacing.sm,
    },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.glass.background,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoPanel: {
        paddingHorizontal: theme.spacing.md,
        marginTop: theme.spacing.md,
        width: '100%',
    },
    infoContainer: {
        padding: theme.spacing.md,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    infoBadge: {
        width: 44,
        height: 44,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoText: {
        flex: 1,
    },
    infoTitle: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.semibold,
    },
    infoSubtitle: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
    },
    infoStats: {
        marginTop: theme.spacing.sm,
        paddingTop: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.glass.border,
    },
    infoStat: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.sm,
    },
    infoStatValue: {
        color: theme.colors.primary.base,
        fontWeight: theme.typography.weights.bold,
    },
    legend: {
        paddingHorizontal: theme.spacing.md,
        marginTop: theme.spacing.md,
        width: '100%',
    },
    legendTitle: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: theme.spacing.sm,
    },
    legendItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.xs,
    },
    bottomPadding: {
        height: 100,
    },
});
