import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';

import theme from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { GlassContainer } from '@/components/ui/GlassContainer';

const { width, height } = Dimensions.get('window');

interface TourSlide {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    gradient: readonly [string, string];
}

const TOUR_SLIDES: TourSlide[] = [
    {
        id: '1',
        title: 'Remember Everything',
        description:
            'Never forget where you put your important items. Your spatial memory assistant remembers for you.',
        icon: 'bulb',
        gradient: ['#8B5CF6', '#6366F1'],
    },
    {
        id: '2',
        title: 'Speak Naturally',
        description:
            'Just talk to remember or find things. "I put my keys on the kitchen counter" - that\'s all it takes.',
        icon: 'mic',
        gradient: ['#22D3EE', '#06B6D4'],
    },
    {
        id: '3',
        title: 'Find Instantly',
        description:
            'Ask where anything is and get instant answers. Browse and search through all your stored memories.',
        icon: 'search',
        gradient: ['#34D399', '#10B981'],
    },
    {
        id: '4',
        title: 'See Connections',
        description:
            'Visualize how your items and locations connect. Discover patterns in your spatial memory.',
        icon: 'git-network',
        gradient: ['#FB7185', '#F43F5E'],
    },
];

export default function TourScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useSharedValue(0);

    const handleNext = () => {
        if (currentIndex < TOUR_SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            router.replace('/(tabs)');
        }
    };

    const handleSkip = () => {
        router.replace('/(tabs)');
    };

    const renderSlide = ({ item, index }: { item: TourSlide; index: number }) => (
        <View style={styles.slide}>
            <Animated.View
                entering={FadeInDown.delay(200).duration(600)}
                style={styles.iconContainer}
            >
                <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                >
                    <Ionicons name={item.icon} size={48} color="#fff" />
                </LinearGradient>
            </Animated.View>

            <Animated.Text
                entering={FadeInUp.delay(300).duration(600)}
                style={styles.slideTitle}
            >
                {item.title}
            </Animated.Text>

            <Animated.Text
                entering={FadeInUp.delay(400).duration(600)}
                style={styles.slideDescription}
            >
                {item.description}
            </Animated.Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Background gradient */}
            <LinearGradient
                colors={['rgba(139, 92, 246, 0.1)', 'transparent', 'rgba(99, 102, 241, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={TOUR_SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                    scrollX.value = event.nativeEvent.contentOffset.x;
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    if (index !== currentIndex) {
                        setCurrentIndex(index);
                    }
                }}
                scrollEventThrottle={16}
                style={styles.flatList}
            />

            {/* Pagination Dots */}
            <View style={styles.pagination}>
                {TOUR_SLIDES.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            index === currentIndex && styles.dotActive,
                        ]}
                    />
                ))}
            </View>

            {/* Bottom Actions */}
            <View style={styles.bottomContainer}>
                <Button
                    title={currentIndex === TOUR_SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    onPress={handleNext}
                    size="lg"
                    style={styles.nextButton}
                    icon={
                        currentIndex === TOUR_SLIDES.length - 1 ? (
                            <Ionicons name="rocket" size={20} color="#fff" />
                        ) : (
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        )
                    }
                />

                {currentIndex === TOUR_SLIDES.length - 1 && (
                    <TouchableOpacity
                        style={styles.loginLink}
                        onPress={() => router.push('/(auth)/login')}
                    >
                        <Text style={styles.loginText}>
                            Already have an account? <Text style={styles.loginTextBold}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: theme.spacing.lg,
        zIndex: 10,
        padding: theme.spacing.sm,
    },
    skipText: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.base,
    },
    flatList: {
        flex: 1,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    iconContainer: {
        marginBottom: theme.spacing['2xl'],
    },
    iconGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    slideTitle: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes['3xl'],
        fontWeight: theme.typography.weights.bold,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    slideDescription: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.lg,
        textAlign: 'center',
        lineHeight: 28,
        maxWidth: 320,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.xl,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.glass.border,
    },
    dotActive: {
        width: 24,
        backgroundColor: theme.colors.primary.base,
    },
    bottomContainer: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
        alignItems: 'center',
    },
    nextButton: {
        width: '100%',
    },
    loginLink: {
        marginTop: theme.spacing.lg,
    },
    loginText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.base,
    },
    loginTextBold: {
        color: theme.colors.primary.base,
        fontWeight: theme.typography.weights.semibold,
    },
});
