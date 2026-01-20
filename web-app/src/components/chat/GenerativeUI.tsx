import { Paper, Group, Text, Badge, Stack, Box, ThemeIcon } from '@mantine/core';
import {
  IconMapPin,
  IconBox,
  IconCheck,
  IconInfoCircle,
  IconKey,
  IconDeviceMobile,
  IconFileText,
  IconUser,
  IconHome,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { ToolResult } from '@/api/types';
import { categories, type CategoryKey } from '@/api/types';

interface GenerativeUIProps {
  toolResult: ToolResult;
}

const categoryIcons: Record<CategoryKey, React.ComponentType<{ size: number }>> = {
  keys: IconKey,
  electronics: IconDeviceMobile,
  documents: IconFileText,
  personal: IconUser,
  home: IconHome,
  other: IconBox,
};

export function GenerativeUI({ toolResult }: GenerativeUIProps) {
  const { name, result } = toolResult;

  // Render different UI based on tool name
  switch (name) {
    case 'find_thing':
      return <FindThingResult result={result} />;
    case 'store_thing':
      return <StoreThingResult result={result} />;
    case 'remember_location':
      return <RememberLocationResult result={result} />;
    case 'list_things':
      return <ListThingsResult result={result} />;
    default:
      return <GenericResult name={name} result={result} />;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FindThingResult({ result }: { result: any }) {
  if (!result || !result.things || result.things.length === 0) {
    return (
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
        }}
      >
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" color="red" variant="light">
            <IconInfoCircle size={20} />
          </ThemeIcon>
          <Text size="sm">No items found matching your search.</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Stack gap="sm">
        {result.things.map((thing: { id: string; name: string; location?: string; location_path?: string; category?: string; tags?: string[] }) => (
          <ItemCard key={thing.id} item={thing} />
        ))}
      </Stack>
    </motion.div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StoreThingResult({ result }: { result: any }) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      }}
    >
      <Group gap="sm">
        <ThemeIcon size="lg" radius="md" color="green" variant="light">
          <IconCheck size={20} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            Stored successfully!
          </Text>
          {result?.name && result?.location && (
            <Text size="xs" c="dimmed">
              {result.name} → {result.location}
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RememberLocationResult({ result }: { result: any }) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}
    >
      <Group gap="sm">
        <ThemeIcon size="lg" radius="md" color="amber" variant="light">
          <IconMapPin size={20} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            Location remembered!
          </Text>
          {result?.message && (
            <Text size="xs" c="dimmed">
              {result.message}
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ListThingsResult({ result }: { result: any }) {
  if (!result || !result.things || result.things.length === 0) {
    return (
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'rgba(107, 114, 128, 0.1)',
          border: '1px solid rgba(107, 114, 128, 0.2)',
        }}
      >
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" color="gray" variant="light">
            <IconBox size={20} />
          </ThemeIcon>
          <Text size="sm">No items stored yet. Tell me where you put something!</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {result.things.slice(0, 5).map((thing: { id: string; name: string; location?: string; category?: string }) => (
        <ItemCard key={thing.id} item={thing} compact />
      ))}
      {result.things.length > 5 && (
        <Text size="xs" c="dimmed" ta="center">
          +{result.things.length - 5} more items
        </Text>
      )}
    </Stack>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GenericResult({ name, result }: { name: string; result: any }) {
  return (
    <Paper
      p="sm"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Stack gap="xs">
        <Badge size="sm" variant="light" color="gray">
          {name}
        </Badge>
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </Text>
      </Stack>
    </Paper>
  );
}

interface ItemCardProps {
  item: {
    id: string;
    name: string;
    location?: string;
    location_path?: string;
    category?: string;
    tags?: string[];
  };
  compact?: boolean;
}

function ItemCard({ item, compact }: ItemCardProps) {
  const category = (item.category as CategoryKey) || 'other';
  const categoryInfo = categories[category] || categories.other;
  const Icon = categoryIcons[category] || IconBox;

  if (compact) {
    return (
      <Paper
        p="sm"
        radius="md"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Group gap="sm">
          <ThemeIcon
            size="md"
            radius="md"
            style={{ background: `${categoryInfo.color}20`, color: categoryInfo.color }}
          >
            <Icon size={16} />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {item.name}
            </Text>
          </Box>
          {item.location && (
            <Text size="xs" c="dimmed">
              {item.location}
            </Text>
          )}
        </Group>
      </Paper>
    );
  }

  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Group gap="md">
        <ThemeIcon
          size="xl"
          radius="md"
          style={{ background: `${categoryInfo.color}20`, color: categoryInfo.color }}
        >
          <Icon size={24} />
        </ThemeIcon>
        <Box style={{ flex: 1 }}>
          <Text size="sm" fw={600}>
            {item.name}
          </Text>
          {(item.location_path || item.location) && (
            <Group gap="xs" mt={4}>
              <IconMapPin size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                {item.location_path || item.location}
              </Text>
            </Group>
          )}
          {item.tags && item.tags.length > 0 && (
            <Group gap={4} mt="xs">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} size="xs" variant="light" color="gray">
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
        </Box>
      </Group>
    </Paper>
  );
}
