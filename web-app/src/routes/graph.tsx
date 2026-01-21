import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Box,
  Text,
  Stack,
  Badge,
  ActionIcon,
  Tooltip,
  Center,
  ThemeIcon,
  Loader,
  Paper,
  Group,
  CloseButton,
} from '@mantine/core';
import {
  IconRefresh,
  IconBox,
  IconMapPin,
  IconFocus2,
} from '@tabler/icons-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useGraph } from '@/api';
import type { GraphNode } from '@/api/types';

// Colors for different node types
const nodeTypeColors = {
  thing: '#f59e0b',   // Amber for things
  place: '#10b981',   // Green for places
  intent: '#8b5cf6',  // Purple for intents
};

interface GraphDataForForce {
  nodes: (GraphNode & { color: string; size: number })[];
  links: { source: string; target: string; type: string }[];
}

export function GraphPage() {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { data: graphData, isLoading, refetch } = useGraph();

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Transform data for force graph - places attract their things
  const forceData = useMemo<GraphDataForForce>(() => {
    if (!graphData) {
      return { nodes: [], links: [] };
    }

    // Places are larger and act as cluster centers
    const nodes = graphData.nodes.map((node) => ({
      ...node,
      color: nodeTypeColors[node.type] || nodeTypeColors.thing,
      // Places are bigger to act as visual anchors
      size: node.type === 'place' ? 16 : node.type === 'intent' ? 10 : 12,
    }));

    // Links connect things to places (LOCATED_IN)
    const links = graphData.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }));

    return { nodes, links };
  }, [graphData]);

  // Handle node click/tap
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode);
  }, []);

  // Fit graph to view
  const handleReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 60);
    }
    setSelectedNode(null);
  }, []);

  // Fit to view when data loads
  useEffect(() => {
    if (forceData.nodes.length > 0 && graphRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 60);
      }, 500);
    }
  }, [forceData.nodes.length]);

  // Custom node rendering - simple circles with labels
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = selectedNode?.id === node.id;
      const size = node.size;
      const isPlace = node.type === 'place';

      // Glow effect for selected node
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2.5, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, size * 2.5
        );
        gradient.addColorStop(0, `${node.color}60`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border - places have thicker border
      ctx.strokeStyle = isSelected ? '#ffffff' : `${node.color}80`;
      ctx.lineWidth = isPlace ? 3 : (isSelected ? 2 : 1);
      ctx.stroke();

      // Always show label for places, show for things when zoomed in or selected
      const showLabel = isPlace || isSelected || globalScale > 1.2;
      if (showLabel) {
        const label = node.label;
        const fontSize = isPlace 
          ? Math.max(14 / globalScale, 5)
          : Math.max(11 / globalScale, 4);
        ctx.font = `${isPlace ? 'bold' : ''} ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isSelected ? '#ffffff' : (isPlace ? '#ffffff' : 'rgba(255, 255, 255, 0.8)');
        ctx.fillText(label, node.x, node.y + size + 4);
      }
    },
    [selectedNode]
  );

  return (
    <Box 
      ref={containerRef}
      style={{ 
        height: 'calc(100vh - 60px)', 
        width: '100%',
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(16,185,129,0.02) 100%)',
      }}
    >
      {/* Header - minimal */}
      <Box
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        <Stack gap={0}>
          <Text size="lg" fw={700} c="white">
            Memory Graph
          </Text>
          <Text size="xs" c="dimmed">
            {isLoading
              ? 'Loading...'
              : forceData.nodes.length === 0
              ? 'No items yet'
              : `${forceData.nodes.filter(n => n.type === 'thing').length} items in ${forceData.nodes.filter(n => n.type === 'place').length} places`}
          </Text>
        </Stack>

        <Group gap="xs" style={{ pointerEvents: 'auto' }}>
          <Tooltip label="Reset View">
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              onClick={handleReset}
              radius="xl"
            >
              <IconFocus2 size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              onClick={() => refetch()}
              loading={isLoading}
              radius="xl"
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      {/* Graph */}
      {isLoading ? (
        <Center h="100%">
          <Stack align="center" gap="md">
            <Loader size="lg" color="teal" />
            <Text c="dimmed">Loading your memory graph...</Text>
          </Stack>
        </Center>
      ) : forceData.nodes.length === 0 ? (
        <Center h="100%">
          <Stack align="center" gap="md">
            <ThemeIcon size={80} radius="xl" color="gray" variant="light">
              <IconBox size={40} />
            </ThemeIcon>
            <Text size="lg" fw={600}>
              No items yet
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={300}>
              Tell the assistant where you put things to see them here.
            </Text>
          </Stack>
        </Center>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={forceData}
          width={dimensions.width}
          height={dimensions.height}
          nodeId="id"
          nodeLabel=""
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            // Larger touch area for mobile
            ctx.arc(node.x!, node.y!, (node as any).size * 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => setSelectedNode(null)}
          linkColor={() => 'rgba(16, 185, 129, 0.3)'}
          linkWidth={2}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.003}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleColor={() => '#10b981'}
          // Force configuration for natural clustering
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.4}
          d3AlphaMin={0.001}
          warmupTicks={100}
          cooldownTicks={200}
          backgroundColor="transparent"
          // Enable touch interactions
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      )}

      {/* Selected Node Info - floating card at bottom */}
      {selectedNode && (
        <Paper
          shadow="lg"
          radius="lg"
          p="md"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 250,
            maxWidth: 'calc(100% - 48px)',
            background: 'rgba(30, 30, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            zIndex: 20,
          }}
        >
          <Group justify="space-between" mb="xs">
            <Group gap="sm">
              <ThemeIcon
                size="lg"
                radius="md"
                style={{
                  background: `${nodeTypeColors[selectedNode.type]}20`,
                  color: nodeTypeColors[selectedNode.type],
                }}
              >
                {selectedNode.type === 'place' ? (
                  <IconMapPin size={20} />
                ) : (
                  <IconBox size={20} />
                )}
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={600}>
                  {selectedNode.label}
                </Text>
                <Badge 
                  size="xs" 
                  variant="light" 
                  color={selectedNode.type === 'place' ? 'teal' : 'orange'}
                >
                  {selectedNode.type}
                </Badge>
              </Box>
            </Group>
            <CloseButton 
              size="sm" 
              onClick={() => setSelectedNode(null)}
              variant="subtle"
            />
          </Group>
          
          {/* Show connected items for places */}
          {selectedNode.type === 'place' && (
            <Text size="xs" c="dimmed">
              {forceData.links.filter(l => 
                l.target === selectedNode.id || 
                (typeof l.target === 'object' && (l.target as any).id === selectedNode.id)
              ).length} items stored here
            </Text>
          )}
        </Paper>
      )}

      {/* Legend - bottom left, minimal */}
      <Box
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          display: 'flex',
          gap: 16,
          opacity: 0.7,
        }}
      >
        <Group gap={6}>
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: nodeTypeColors.thing,
            }}
          />
          <Text size="xs" c="dimmed">Items</Text>
        </Group>
        <Group gap={6}>
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: nodeTypeColors.place,
            }}
          />
          <Text size="xs" c="dimmed">Places</Text>
        </Group>
      </Box>
    </Box>
  );
}
