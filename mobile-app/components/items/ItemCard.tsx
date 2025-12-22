import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';

import theme, { categories, CategoryKey } from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - theme.spacing.md * 3) / 2;

interface ItemCardProps {
    id: string;
    name: string;
    location: string;
    category: CategoryKey;
    onPress?: () => void;
    index?: number;
}

export function ItemCard({
    id,
    name,
    location,
    category,
    onPress,
    index = 0,
}: ItemCardProps) {
    const categoryInfo = categories[category] || categories.other;
    const iconName = categoryInfo.icon as React.ComponentProps<typeof Ionicons>['name'];

    return (
        <Animated.View
            entering={FadeInUp.delay(index * 50).duration(300)}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.touchable}
            >
                <GlassContainer style={styles.card} variant="card">
                    {/* Icon Background */}
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={[categoryInfo.color + '30', categoryInfo.color + '10']}
                            style={styles.iconGradient}
                        >
                            <Ionicons
                                name={iconName}
                                size={32}
                                color={categoryInfo.color}
                            />
                        </LinearGradient>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={styles.name} numberOfLines={1}>
                            {name}
                        </Text>
                        <View style={styles.locationRow}>
                            <Ionicons
                                name="location-outline"
                                size={14}
                                color={theme.colors.text.muted}
                            />
                            <Text style={styles.location} numberOfLines={1}>
                                {location}
                            </Text>
                        </View>
                    </View>

                    {/* Category indicator */}
                    <View
                        style={[
                            styles.categoryIndicator,
                            { backgroundColor: categoryInfo.color },
                        ]}
                    />
                </GlassContainer>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    touchable: {
        width: CARD_WIDTH,
    },
    card: {
        padding: theme.spacing.md,
        height: 140,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    iconContainer: {
        alignSelf: 'flex-start',
    },
    iconGradient: {
        width: 56,
        height: 56,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        gap: theme.spacing.xs,
    },
    name: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.base,
        fontWeight: theme.typography.weights.semibold,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    location: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
        flex: 1,
    },
    categoryIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 4,
        height: 32,
        borderBottomLeftRadius: theme.borderRadius.sm,
    },
});

export default ItemCard;
