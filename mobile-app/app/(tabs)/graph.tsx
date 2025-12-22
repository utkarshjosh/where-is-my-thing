import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';

import theme, { categories, CategoryKey } from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';

const { width, height } = Dimensions.get('window');
const GRAPH_SIZE = width - theme.spacing.md * 2;

// Mock graph data - nodes and edges
const MOCK_NODES = [
    { id: '1', label: 'Keys', category: 'keys' as CategoryKey, x: 0.5, y: 0.3 },
    { id: '2', label: 'Wallet', category: 'personal' as CategoryKey, x: 0.3, y: 0.5 },
    { id: '3', label: 'Phone', category: 'electronics' as CategoryKey, x: 0.7, y: 0.5 },
    { id: '4', label: 'Home', category: 'home' as CategoryKey, x: 0.5, y: 0.55 },
    { id: '5', label: 'Docs', category: 'documents' as CategoryKey, x: 0.2, y: 0.7 },
    { id: '6', label: 'Laptop', category: 'electronics' as CategoryKey, x: 0.8, y: 0.7 },
];

const MOCK_EDGES = [
    { from: '1', to: '4' },
    { from: '2', to: '4' },
    { from: '3', to: '4' },
    { from: '4', to: '5' },
    { from: '4', to: '6' },
    { from: '1', to: '2' },
    { from: '3', to: '6' },
];

export default function GraphScreen() {
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [scale, setScale] = useState(1);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const panResponder = useRef(
        PanResponder.create({
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
    ).current;

    const graphStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale },
        ],
    }));

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

    // Get node position in pixels
    const getNodePosition = (node: typeof MOCK_NODES[0]) => ({
        x: node.x * GRAPH_SIZE,
        y: node.y * GRAPH_SIZE,
    });

    // Check if edge is connected to selected node
    const isEdgeHighlighted = (edge: typeof MOCK_EDGES[0]) => {
        return selectedNode && (edge.from === selectedNode || edge.to === selectedNode);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Memory Graph</Text>
                <Text style={styles.subtitle}>Visualize connections</Text>
            </View>

            {/* Graph Container */}
            <View style={styles.graphWrapper}>
                <GlassContainer style={styles.graphContainer}>
                    <Animated.View
                        {...panResponder.panHandlers}
                        style={[styles.graph, graphStyle]}
                    >
                        <Svg width={GRAPH_SIZE} height={GRAPH_SIZE}>
                            <Defs>
                                <RadialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
                                    <Stop offset="0%" stopColor={theme.colors.primary.light} stopOpacity="0.8" />
                                    <Stop offset="100%" stopColor={theme.colors.primary.dark} stopOpacity="0.6" />
                                </RadialGradient>
                            </Defs>

                            {/* Edges */}
                            {MOCK_EDGES.map((edge, index) => {
                                const fromNode = MOCK_NODES.find((n) => n.id === edge.from);
                                const toNode = MOCK_NODES.find((n) => n.id === edge.to);
                                if (!fromNode || !toNode) return null;

                                const from = getNodePosition(fromNode);
                                const to = getNodePosition(toNode);
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
                            {MOCK_NODES.map((node) => {
                                const pos = getNodePosition(node);
                                const categoryColor = categories[node.category]?.color || theme.colors.primary.base;
                                const isSelected = selectedNode === node.id;
                                const isConnected =
                                    selectedNode &&
                                    MOCK_EDGES.some(
                                        (e) =>
                                            (e.from === selectedNode && e.to === node.id) ||
                                            (e.to === selectedNode && e.from === node.id)
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
                        {MOCK_NODES.map((node) => {
                            const pos = getNodePosition(node);
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
                            const node = MOCK_NODES.find((n) => n.id === selectedNode);
                            if (!node) return null;
                            const connections = MOCK_EDGES.filter(
                                (e) => e.from === selectedNode || e.to === selectedNode
                            ).length;
                            const categoryInfo = categories[node.category];

                            return (
                                <>
                                    <View style={styles.infoHeader}>
                                        <View
                                            style={[
                                                styles.infoBadge,
                                                { backgroundColor: categoryInfo.color + '30' },
                                            ]}
                                        >
                                            <Ionicons
                                                name={categoryInfo.icon as any}
                                                size={20}
                                                color={categoryInfo.color}
                                            />
                                        </View>
                                        <View style={styles.infoText}>
                                            <Text style={styles.infoTitle}>{node.label}</Text>
                                            <Text style={styles.infoSubtitle}>{categoryInfo.label}</Text>
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
    graphWrapper: {
        flex: 1,
        padding: theme.spacing.md,
        position: 'relative',
    },
    graphContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    graph: {
        width: GRAPH_SIZE,
        height: GRAPH_SIZE,
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
