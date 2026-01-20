import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Tooltip,
  TextInput,
  Center,
  ThemeIcon,
  Skeleton,
  SegmentedControl,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
  IconFocus2,
  IconBox,
  IconMapPin,
  IconTarget,
  IconKey,
  IconDeviceMobile,
  IconFileText,
  IconUser,
  IconHome,
} from '@tabler/icons-react';
import ForceGraph2D from 'react-force-graph-2d';
import { useGraph } from '@/api';
import { categories, type CategoryKey, type GraphNode } from '@/api/types';

const categoryColors: Record<string, string> = {
  keys: '#f59e0b',
  electronics: '#3b82f6',
  documents: '#8b5cf6',
  personal: '#ec4899',
  home: '#10b981',
  other: '#6b7280',
};

const nodeTypeColors = {
  thing: '#f59e0b',
  place: '#10b981',
  intent: '#8b5cf6',
};

const categoryIcons: Record<CategoryKey, React.ComponentType<{ size: number }>> = {
  keys: IconKey,
  electronics: IconDeviceMobile,
  documents: IconFileText,
  personal: IconUser,
  home: IconHome,
  other: IconBox,
};

interface GraphDataForForce {
  nodes: (GraphNode & { color: string; size: number })[];
  links: { source: string; target: string; type: string; color: string }[];
}

export function GraphPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'thing' | 'place' | 'intent'>('all');

  const { data: graphData, isLoading, refetch } = useGraph();

  // Transform data for force graph
  const forceData = useMemo<GraphDataForForce>(() => {
    if (!graphData) {
      return { nodes: [], links: [] };
    }

    let filteredNodes = graphData.nodes;

    // Filter by type
    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter((n) => n.type === filterType);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter((n) =>
        n.label.toLowerCase().includes(query)
      );
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    const nodes = filteredNodes.map((node) => ({
      ...node,
      color: node.category
        ? categoryColors[node.category] || nodeTypeColors[node.type]
        : nodeTypeColors[node.type],
      size: node.type === 'place' ? 12 : node.type === 'intent' ? 8 : 10,
    }));

    const links = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        color: 'rgba(255, 255, 255, 0.15)',
      }));

    return { nodes, links };
  }, [graphData, filterType, searchQuery]);

  // Handle node click
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode);

    // Center on node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom?.() || 1;
      graphRef.current.zoom?.(currentZoom * 1.5, 300);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom?.() || 1;
      graphRef.current.zoom?.(currentZoom / 1.5, 300);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit?.(400, 50);
    }
    setSelectedNode(null);
  }, []);

  // Custom node rendering
  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = selectedNode?.id === node.id;
      const size = node.size;

      // Glow effect for selected node
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          size * 2
        );
        gradient.addColorStop(0, `${node.color}40`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#ffffff' : `${node.color}80`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label (only show when zoomed in enough)
      if (globalScale > 1.5 || isSelected) {
        const label = node.label;
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(label, node.x, node.y + size + 4);
      }
    },
    [selectedNode]
  );

  return (
    <Box style={{ height: 'calc(100vh - 60px - 32px)' }}>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text size="xl" fw={700}>
            Memory Graph
          </Text>
          <Text size="sm" c="dimmed">
            {isLoading
              ? 'Loading...'
              : `${forceData.nodes.length} nodes, ${forceData.links.length} connections`}
          </Text>
        </Stack>

        <Group gap="sm">
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              onClick={() => refetch()}
              loading={isLoading}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group gap="md" align="flex-start" style={{ height: 'calc(100% - 60px)' }}>
        {/* Graph Canvas */}
        <Paper
          radius="lg"
          style={{
            flex: 1,
            height: '100%',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {isLoading ? (
            <Center h="100%">
              <Stack align="center" gap="md">
                <Skeleton height={200} width={200} radius="xl" />
                <Text c="dimmed">Loading graph...</Text>
              </Stack>
            </Center>
          ) : forceData.nodes.length === 0 ? (
            <Center h="100%">
              <Stack align="center" gap="md">
                <ThemeIcon size={80} radius="xl" color="gray" variant="light">
                  <IconBox size={40} />
                </ThemeIcon>
                <Text size="lg" fw={600}>
                  No data yet
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={300}>
                  Start by telling the assistant where you put things to build your memory graph.
                </Text>
              </Stack>
            </Center>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={forceData}
              nodeId="id"
              nodeLabel="label"
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, (node as any).size * 1.5, 0, 2 * Math.PI);
                ctx.fill();
              }}
              onNodeClick={handleNodeClick}
              linkColor={(link) => (link as any).color}
              linkWidth={1}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              warmupTicks={100}
              cooldownTicks={100}
              backgroundColor="transparent"
            />
          )}

          {/* Zoom Controls */}
          <Box
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Tooltip label="Zoom In" position="left">
              <ActionIcon
                variant="light"
                color="gray"
                size="lg"
                onClick={handleZoomIn}
              >
                <IconZoomIn size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Zoom Out" position="left">
              <ActionIcon
                variant="light"
                color="gray"
                size="lg"
                onClick={handleZoomOut}
              >
                <IconZoomOut size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reset View" position="left">
              <ActionIcon
                variant="light"
                color="gray"
                size="lg"
                onClick={handleReset}
              >
                <IconFocus2 size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        </Paper>

        {/* Sidebar */}
        <Paper
          p="md"
          radius="lg"
          style={{
            width: 280,
            height: '100%',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack gap="md" style={{ flex: 1 }}>
            {/* Search */}
            <TextInput
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={16} />}
              size="sm"
              styles={{
                input: {
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                },
              }}
            />

            {/* Filter by type */}
            <Box>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>
                Filter by Type
              </Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={filterType}
                onChange={(value) =>
                  setFilterType(value as 'all' | 'thing' | 'place' | 'intent')
                }
                data={[
                  { value: 'all', label: 'All' },
                  { value: 'thing', label: 'Things' },
                  { value: 'place', label: 'Places' },
                  { value: 'intent', label: 'Intents' },
                ]}
              />
            </Box>

            {/* Selected Node Info */}
            {selectedNode && (
              <Paper
                p="md"
                radius="md"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Stack gap="sm">
                  <Group gap="sm">
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      style={{
                        background: `${
                          selectedNode.category
                            ? categoryColors[selectedNode.category]
                            : nodeTypeColors[selectedNode.type]
                        }20`,
                        color: selectedNode.category
                          ? categoryColors[selectedNode.category]
                          : nodeTypeColors[selectedNode.type],
                      }}
                    >
                      {selectedNode.type === 'place' ? (
                        <IconMapPin size={20} />
                      ) : selectedNode.type === 'intent' ? (
                        <IconTarget size={20} />
                      ) : (
                        <IconBox size={20} />
                      )}
                    </ThemeIcon>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>
                        {selectedNode.label}
                      </Text>
                      <Text size="xs" c="dimmed" tt="capitalize">
                        {selectedNode.type}
                      </Text>
                    </Box>
                  </Group>

                  {selectedNode.category && (
                    <Badge
                      size="sm"
                      variant="light"
                      color="gray"
                      leftSection={(() => {
                        const Icon =
                          categoryIcons[selectedNode.category as CategoryKey] ||
                          IconBox;
                        return <Icon size={12} />;
                      })()}
                    >
                      {categories[selectedNode.category as CategoryKey]?.label ||
                        selectedNode.category}
                    </Badge>
                  )}

                  <Text size="xs" c="dimmed">
                    {
                      forceData.links.filter(
                        (l) =>
                          l.source === selectedNode.id ||
                          l.target === selectedNode.id
                      ).length
                    }{' '}
                    connections
                  </Text>
                </Stack>
              </Paper>
            )}

            {/* Legend */}
            <Box style={{ marginTop: 'auto' }}>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>
                Legend
              </Text>
              <Stack gap="xs">
                <Group gap="xs">
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: nodeTypeColors.thing,
                    }}
                  />
                  <Text size="xs">Things</Text>
                </Group>
                <Group gap="xs">
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: nodeTypeColors.place,
                    }}
                  />
                  <Text size="xs">Places</Text>
                </Group>
                <Group gap="xs">
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: nodeTypeColors.intent,
                    }}
                  />
                  <Text size="xs">Intents</Text>
                </Group>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Group>
    </Box>
  );
}
