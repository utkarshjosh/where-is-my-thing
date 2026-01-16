import React, { useState, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import theme, { CategoryKey } from '@/constants/theme';
import { FilterBar } from '@/components/items/FilterBar';
import { ItemCard } from '@/components/items/ItemCard';
import { useItems } from '@/hooks/useItems';

// Delay before refetching when page comes into focus (in milliseconds)
const REFETCH_DELAY = 1000; // 1 second delay

export default function ItemsScreen() {
    const { items, isLoading, error, searchQuery, search, refresh, fetchItems } = useItems({ autoFetch: false });
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);
    const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Lazy refetch when page comes into focus with delay
    useFocusEffect(
        React.useCallback(() => {
            // Clear any existing timer
            if (refetchTimerRef.current) {
                clearTimeout(refetchTimerRef.current);
            }

            // Schedule refetch after delay
            refetchTimerRef.current = setTimeout(() => {
                fetchItems();
            }, REFETCH_DELAY);

            // Cleanup timer on unmount or when leaving focus
            return () => {
                if (refetchTimerRef.current) {
                    clearTimeout(refetchTimerRef.current);
                    refetchTimerRef.current = null;
                }
            };
        }, [fetchItems])
    );

    // Handle pull-to-refresh
    const onRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    // Filter items based on category (search is handled by the hook)
    const filteredItems = useMemo(() => {
        if (selectedCategory === 'all') {
            return items;
        }
        return items.filter((item) => item.category === selectedCategory);
    }, [items, selectedCategory]);

    // Group items by category
    const groupedItems = useMemo(() => {
        if (selectedCategory !== 'all') {
            return { [selectedCategory]: filteredItems };
        }

        return filteredItems.reduce((acc, item) => {
            const cat = (item.category || 'other') as CategoryKey;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {} as Record<CategoryKey, typeof filteredItems>);
    }, [filteredItems, selectedCategory]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Items</Text>
                <Text style={styles.subtitle}>
                    {isLoading ? 'Loading...' : `${items.length} items stored`}
                </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons
                        name="search"
                        size={20}
                        color={theme.colors.text.muted}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search items..."
                        placeholderTextColor={theme.colors.text.muted}
                        value={searchQuery}
                        onChangeText={search}
                    />
                    {searchQuery.length > 0 && (
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={theme.colors.text.muted}
                            onPress={() => search('')}
                        />
                    )}
                    {isLoading && (
                        <ActivityIndicator size="small" color={theme.colors.primary.base} />
                    )}
                </View>
            </View>

            {/* Filter Bar */}
            <FilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            {/* Error State */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={24} color={theme.colors.error} />
                    <Text style={styles.errorText}>{error.message}</Text>
                </View>
            )}

            {/* Items List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary.base}
                    />
                }
            >
                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                    <View key={category} style={styles.categorySection}>
                        {selectedCategory === 'all' && (
                            <Text style={styles.categoryTitle}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </Text>
                        )}
                        <View style={styles.itemsGrid}>
                            {categoryItems.map((item, index) => (
                                <ItemCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    location={item.location_path || item.location || 'Unknown'}
                                    category={item.category as CategoryKey}
                                    index={index}
                                    onPress={() => {
                                        // TODO: Navigate to item details
                                        console.log('Navigate to item:', item.id);
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                ))}

                {!isLoading && filteredItems.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="search-outline"
                            size={48}
                            color={theme.colors.text.muted}
                        />
                        <Text style={styles.emptyStateText}>No items found</Text>
                        <Text style={styles.emptyStateSubtext}>
                            {searchQuery
                                ? 'Try adjusting your search or filters'
                                : 'Start by telling the voice assistant where you put things'}
                        </Text>
                    </View>
                )}

                {/* Bottom padding for tab bar */}
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
    searchContainer: {
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.glass.background,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.sm,
    },
    searchInput: {
        flex: 1,
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.base,
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.sm,
    },
    categorySection: {
        marginBottom: theme.spacing.lg,
    },
    categoryTitle: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: theme.spacing.sm,
    },
    itemsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing['3xl'],
    },
    emptyStateText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.medium,
        marginTop: theme.spacing.md,
    },
    emptyStateSubtext: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
        marginTop: theme.spacing.xs,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    bottomPadding: {
        height: 100,
    },
});
