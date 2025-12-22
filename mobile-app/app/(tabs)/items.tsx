import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import theme, { CategoryKey } from '@/constants/theme';
import { FilterBar } from '@/components/items/FilterBar';
import { ItemCard } from '@/components/items/ItemCard';

// Mock data - will be replaced with real data from backend
const MOCK_ITEMS = [
    { id: '1', name: 'House Keys', location: 'Kitchen drawer', category: 'keys' as CategoryKey },
    { id: '2', name: 'Wallet', location: 'Bedroom nightstand', category: 'personal' as CategoryKey },
    { id: '3', name: 'iPhone Charger', location: 'Office desk', category: 'electronics' as CategoryKey },
    { id: '4', name: 'Laptop', location: 'Home office', category: 'electronics' as CategoryKey },
    { id: '5', name: 'Passport', location: 'Safe box', category: 'documents' as CategoryKey },
    { id: '6', name: 'Umbrella', location: 'Coat closet', category: 'home' as CategoryKey },
    { id: '7', name: 'Sunglasses', location: 'Car glove box', category: 'personal' as CategoryKey },
    { id: '8', name: 'Power Bank', location: 'Backpack', category: 'electronics' as CategoryKey },
    { id: '9', name: 'Spare Car Key', location: 'Kitchen cabinet', category: 'keys' as CategoryKey },
    { id: '10', name: 'Tax Documents', location: 'Filing cabinet', category: 'documents' as CategoryKey },
];

export default function ItemsScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');

    // Filter items based on search and category
    const filteredItems = useMemo(() => {
        return MOCK_ITEMS.filter((item) => {
            const matchesSearch =
                searchQuery === '' ||
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.location.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory =
                selectedCategory === 'all' || item.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    // Group items by category
    const groupedItems = useMemo(() => {
        if (selectedCategory !== 'all') {
            return { [selectedCategory]: filteredItems };
        }

        return filteredItems.reduce((acc, item) => {
            const cat = item.category;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {} as Record<CategoryKey, typeof MOCK_ITEMS>);
    }, [filteredItems, selectedCategory]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Items</Text>
                <Text style={styles.subtitle}>{MOCK_ITEMS.length} items stored</Text>
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
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <Ionicons
                            name="close-circle"
                            size={20}
                            color={theme.colors.text.muted}
                            onPress={() => setSearchQuery('')}
                        />
                    )}
                </View>
            </View>

            {/* Filter Bar */}
            <FilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            {/* Items List */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {Object.entries(groupedItems).map(([category, items]) => (
                    <View key={category} style={styles.categorySection}>
                        {selectedCategory === 'all' && (
                            <Text style={styles.categoryTitle}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </Text>
                        )}
                        <View style={styles.itemsGrid}>
                            {items.map((item, index) => (
                                <ItemCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    location={item.location}
                                    category={item.category}
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

                {filteredItems.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons
                            name="search-outline"
                            size={48}
                            color={theme.colors.text.muted}
                        />
                        <Text style={styles.emptyStateText}>No items found</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Try adjusting your search or filters
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
    },
    bottomPadding: {
        height: 100,
    },
});
