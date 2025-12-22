import React from 'react';
import {
    ScrollView,
    TouchableOpacity,
    Text,
    StyleSheet,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

import theme, { categories, CategoryKey } from '@/constants/theme';

interface FilterBarProps {
    selectedCategory: CategoryKey | 'all';
    onSelectCategory: (category: CategoryKey | 'all') => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function FilterBar({ selectedCategory, onSelectCategory }: FilterBarProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollView}
            contentContainerStyle={styles.container}
        >
            <FilterPill
                label="All"
                isSelected={selectedCategory === 'all'}
                onPress={() => onSelectCategory('all')}
            />
            {(Object.keys(categories) as CategoryKey[]).map((key) => (
                <FilterPill
                    key={key}
                    label={categories[key].label}
                    icon={categories[key].icon as React.ComponentProps<typeof Ionicons>['name']}
                    color={categories[key].color}
                    isSelected={selectedCategory === key}
                    onPress={() => onSelectCategory(key)}
                />
            ))}
        </ScrollView>
    );
}

interface FilterPillProps {
    label: string;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    color?: string;
    isSelected: boolean;
    onPress: () => void;
}

function FilterPill({ label, icon, color, isSelected, onPress }: FilterPillProps) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(isSelected ? 1 : 0.98) }],
        backgroundColor: withSpring(
            isSelected ? 'rgba(139, 92, 246, 0.2)' : theme.colors.glass.background
        ),
    }));

    return (
        <AnimatedTouchable
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                styles.pill,
                animatedStyle,
                isSelected && styles.pillSelected,
            ]}
        >
            {icon && (
                <Ionicons
                    name={icon}
                    size={16}
                    color={isSelected ? theme.colors.primary.base : (color || theme.colors.text.muted)}
                />
            )}
            <Text
                style={[
                    styles.pillText,
                    isSelected && styles.pillTextSelected,
                ]}
            >
                {label}
            </Text>
        </AnimatedTouchable>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flexGrow: 0,
    },
    container: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        gap: theme.spacing.xs,
        flexDirection: 'row',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.full,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
    },
    pillSelected: {
        borderColor: theme.colors.primary.base,
    },
    pillText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.xs,
        fontWeight: theme.typography.weights.medium,
    },
    pillTextSelected: {
        color: theme.colors.primary.base,
    },
});

export default FilterBar;
