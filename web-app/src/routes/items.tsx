import { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Text,
  TextInput,
  Group,
  Stack,
  Badge,
  ActionIcon,
  SegmentedControl,
  Skeleton,
  ThemeIcon,
  Tooltip,
  Center,
  Button,
  Modal,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconGridDots,
  IconList,
  IconBox,
  IconMapPin,
  IconKey,
  IconDeviceMobile,
  IconFileText,
  IconBook,
  IconUser,
  IconHome,
  IconRefresh,
  IconFilter,
  IconX,
  IconTrash,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useItems, useSearchItems, useDeleteItem } from '@/api';
import { categories, type CategoryKey, type Item } from '@/api/types';

const categoryIcons: Record<CategoryKey, React.ComponentType<{ size: number }>> = {
  keys: IconKey,
  electronics: IconDeviceMobile,
  documents: IconFileText,
  books: IconBook,
  personal: IconUser,
  home: IconHome,
  other: IconBox,
};

export function ItemsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // Fetch items
  const { data: itemsData, isLoading, refetch } = useItems(100, 0);
  const { data: searchData, isLoading: isSearching } = useSearchItems(
    debouncedSearch,
    debouncedSearch.length > 0
  );

  // Delete mutation
  const deleteItem = useDeleteItem();

  const handleDelete = (item: Item) => {
    setItemToDelete(item);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    deleteItem.mutate(itemToDelete.id, {
      onSuccess: (data) => {
        notifications.show({
          title: 'Item deleted',
          message: data.message || `Deleted "${itemToDelete.name}"`,
          color: 'green',
        });
        setItemToDelete(null);
      },
      onError: (error) => {
        notifications.show({
          title: 'Failed to delete',
          message: error.message || 'Something went wrong',
          color: 'red',
        });
        setItemToDelete(null);
      },
    });
  };

  // Use search results if searching, otherwise use all items
  const items = useMemo(() => {
    const baseItems = debouncedSearch ? searchData?.items : itemsData?.items;
    if (!baseItems) return [];

    // Filter by category
    if (selectedCategory === 'all') return baseItems;
    return baseItems.filter((item) => item.category === selectedCategory);
  }, [debouncedSearch, searchData, itemsData, selectedCategory]);

  // Group items by category for display
  const groupedItems = useMemo(() => {
    if (selectedCategory !== 'all') {
      return { [selectedCategory]: items };
    }

    return items.reduce((acc, item) => {
      const cat = (item.category || 'other') as CategoryKey;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<CategoryKey, Item[]>);
  }, [items, selectedCategory]);

  const totalCount = itemsData?.count || 0;
  const displayCount = items.length;

  return (
    <Box>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Stack gap={2}>
          <Text size="xl" fw={700}>
            My Items
          </Text>
          <Text size="sm" c="dimmed">
            {isLoading ? 'Loading...' : `${totalCount} items stored`}
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

          <SegmentedControl
            size="sm"
            value={viewMode}
            onChange={(value) => setViewMode(value as 'grid' | 'list')}
            data={[
              {
                value: 'grid',
                label: (
                  <Center>
                    <IconGridDots size={16} />
                  </Center>
                ),
              },
              {
                value: 'list',
                label: (
                  <Center>
                    <IconList size={16} />
                  </Center>
                ),
              },
            ]}
          />
        </Group>
      </Group>

      {/* Search and Filters */}
      <Paper
        p="md"
        radius="lg"
        mb="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Stack gap="md">
          {/* Search */}
          <TextInput
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={18} />}
            rightSection={
              searchQuery ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  onClick={() => setSearchQuery('')}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : isSearching ? (
                <Skeleton width={18} height={18} radius="xl" />
              ) : null
            }
            styles={{
              input: {
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              },
            }}
          />

          {/* Category filters */}
          <Group gap="xs">
            <IconFilter size={16} color="var(--mantine-color-dimmed)" />
            <Badge
              variant={selectedCategory === 'all' ? 'filled' : 'light'}
              color={selectedCategory === 'all' ? 'amber' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </Badge>
            {(Object.keys(categories) as CategoryKey[]).map((key) => {
              const cat = categories[key];
              const Icon = categoryIcons[key];
              return (
                <Badge
                  key={key}
                  variant={selectedCategory === key ? 'filled' : 'light'}
                  color={selectedCategory === key ? 'amber' : 'gray'}
                  style={{ cursor: 'pointer' }}
                  leftSection={<Icon size={12} />}
                  onClick={() => setSelectedCategory(key)}
                >
                  {cat.label}
                </Badge>
              );
            })}
          </Group>
        </Stack>
      </Paper>

      {/* Items */}
      {isLoading ? (
        <Grid>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
              <Skeleton height={120} radius="lg" />
            </Grid.Col>
          ))}
        </Grid>
      ) : items.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <Stack gap="xl">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <Box key={category}>
              {selectedCategory === 'all' && (
                <Group gap="sm" mb="md">
                  <ThemeIcon
                    size="sm"
                    radius="md"
                    style={{
                      background: `${categories[category as CategoryKey]?.color || '#6b7280'}20`,
                      color: categories[category as CategoryKey]?.color || '#6b7280',
                    }}
                  >
                    {(() => {
                      const Icon = categoryIcons[category as CategoryKey] || IconBox;
                      return <Icon size={14} />;
                    })()}
                  </ThemeIcon>
                  <Text size="sm" fw={600} tt="capitalize">
                    {categories[category as CategoryKey]?.label || category}
                  </Text>
                  <Badge size="sm" variant="light" color="gray">
                    {categoryItems.length}
                  </Badge>
                </Group>
              )}

              {viewMode === 'grid' ? (
                <Grid>
                  <AnimatePresence mode="popLayout">
                    {categoryItems.map((item, index) => (
                      <Grid.Col key={item.id} span={{ base: 12, sm: 6, md: 4 }}>
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                        >
                          <ItemCard item={item} onDelete={handleDelete} />
                        </motion.div>
                      </Grid.Col>
                    ))}
                  </AnimatePresence>
                </Grid>
              ) : (
                <Stack gap="sm">
                  <AnimatePresence mode="popLayout">
                    {categoryItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <ItemRow item={item} onDelete={handleDelete} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Delete Item"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" color="gray" onClick={() => setItemToDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={confirmDelete}
              loading={deleteItem.isPending}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

function ItemCard({ item, onDelete }: { item: Item; onDelete: (item: Item) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const category = (item.category as CategoryKey) || 'other';
  const categoryInfo = categories[category] || categories.other;
  const Icon = categoryIcons[category] || IconBox;

  return (
    <Paper
      p="md"
      radius="lg"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      {/* Delete button - appears on hover */}
      {isHovered && (
        <Tooltip label="Delete item">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      <Group gap="md" wrap="nowrap">
        <ThemeIcon
          size="xl"
          radius="md"
          style={{
            background: `${categoryInfo.color}15`,
            color: categoryInfo.color,
          }}
        >
          <Icon size={24} />
        </ThemeIcon>

        <Stack gap={4} style={{ flex: 1, overflow: 'hidden' }}>
          <Text size="sm" fw={600} truncate>
            {item.name}
          </Text>

          {(item.location_path || item.location) && (
            <Group gap={4} wrap="nowrap">
              <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed" truncate>
                {item.location_path || item.location}
              </Text>
            </Group>
          )}

          {item.tags && item.tags.length > 0 && (
            <Group gap={4}>
              {item.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} size="xs" variant="light" color="gray">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 2 && (
                <Text size="xs" c="dimmed">
                  +{item.tags.length - 2}
                </Text>
              )}
            </Group>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}

function ItemRow({ item, onDelete }: { item: Item; onDelete: (item: Item) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const category = (item.category as CategoryKey) || 'other';
  const categoryInfo = categories[category] || categories.other;
  const Icon = categoryIcons[category] || IconBox;

  return (
    <Paper
      p="sm"
      px="md"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
          <ThemeIcon
            size="md"
            radius="md"
            style={{
              background: `${categoryInfo.color}15`,
              color: categoryInfo.color,
            }}
          >
            <Icon size={16} />
          </ThemeIcon>

          <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
            {item.name}
          </Text>
        </Group>

        {(item.location_path || item.location) && (
          <Group gap={4} wrap="nowrap" style={{ maxWidth: '40%' }}>
            <IconMapPin size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" truncate>
              {item.location_path || item.location}
            </Text>
          </Group>
        )}

        {item.tags && item.tags.length > 0 && (
          <Group gap={4} wrap="nowrap">
            {item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} size="xs" variant="light" color="gray">
                {tag}
              </Badge>
            ))}
          </Group>
        )}

        {/* Delete button - appears on hover */}
        {isHovered && (
          <Tooltip label="Delete item">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Paper>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md">
        <ThemeIcon size={80} radius="xl" color="gray" variant="light">
          <IconBox size={40} />
        </ThemeIcon>
        <Text size="lg" fw={600}>
          {searchQuery ? 'No items found' : 'No items yet'}
        </Text>
        <Text size="sm" c="dimmed" ta="center" maw={400}>
          {searchQuery
            ? 'Try adjusting your search or filters'
            : 'Start by telling the assistant where you put things. "I put my keys in the kitchen drawer"'}
        </Text>
        {!searchQuery && (
          <Button
            variant="light"
            color="amber"
            onClick={() => (window.location.href = '/')}
          >
            Go to Chat
          </Button>
        )}
      </Stack>
    </Center>
  );
}
