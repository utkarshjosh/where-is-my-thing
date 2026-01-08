import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useUser, useClerk } from '@clerk/clerk-expo';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { Button } from '@/components/ui/Button';

export default function ProfileScreen() {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [isSigningOut, setIsSigningOut] = React.useState(false);

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setIsSigningOut(true);
                        try {
                            await signOut();
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('Sign out error:', error);
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        } finally {
                            setIsSigningOut(false);
                        }
                    },
                },
            ]
        );
    };

    if (!isLoaded) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress;
    const userName = user?.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
        : userEmail || 'User';
    const userInitial = (user?.firstName?.[0] || userEmail?.[0] || 'U').toUpperCase();

    return (
        <SafeAreaView style={styles.container}>
            {/* Background gradient */}
            <LinearGradient
                colors={['rgba(139, 92, 246, 0.08)', 'transparent', 'rgba(99, 102, 241, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(600)}
                    style={styles.header}
                >
                    <Text style={styles.headerTitle}>Profile</Text>
                </Animated.View>

                {/* User Avatar & Name */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(600)}
                    style={styles.avatarContainer}
                >
                    <LinearGradient
                        colors={[theme.colors.primary.base, theme.colors.accent.cyan]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatar}
                    >
                        <Text style={styles.avatarText}>{userInitial}</Text>
                    </LinearGradient>
                    <Text style={styles.userName}>{userName}</Text>
                    {userEmail && (
                        <Text style={styles.userEmail}>{userEmail}</Text>
                    )}
                </Animated.View>

                {/* Profile Info Card */}
                <Animated.View
                    entering={FadeInUp.delay(300).duration(600)}
                    style={styles.cardContainer}
                >
                    <GlassContainer style={styles.card}>
                        <Text style={styles.cardTitle}>Account Details</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="mail-outline" size={20} color={theme.colors.text.muted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Email</Text>
                                <Text style={styles.infoValue}>{userEmail || 'Not set'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="person-outline" size={20} color={theme.colors.text.muted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>First Name</Text>
                                <Text style={styles.infoValue}>{user?.firstName || 'Not set'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="person-outline" size={20} color={theme.colors.text.muted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Last Name</Text>
                                <Text style={styles.infoValue}>{user?.lastName || 'Not set'}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Ionicons name="calendar-outline" size={20} color={theme.colors.text.muted} />
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Member Since</Text>
                                <Text style={styles.infoValue}>
                                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                                </Text>
                            </View>
                        </View>
                    </GlassContainer>
                </Animated.View>

                {/* Actions */}
                <Animated.View
                    entering={FadeInUp.delay(400).duration(600)}
                    style={styles.actionsContainer}
                >
                    <Button
                        title="Sign Out"
                        onPress={handleSignOut}
                        loading={isSigningOut}
                        variant="secondary"
                        size="lg"
                        style={styles.signOutButton}
                        icon={<Ionicons name="log-out-outline" size={20} color={theme.colors.error} />}
                    />
                </Animated.View>

                {/* App Version */}
                <Animated.View
                    entering={FadeInUp.delay(500).duration(600)}
                    style={styles.versionContainer}
                >
                    <Text style={styles.versionText}>Spatial Memory v1.0.0</Text>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.base,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: 120, // Account for tab bar
    },
    header: {
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
    },
    headerTitle: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes['2xl'],
        fontWeight: theme.typography.weights.bold,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.md,
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    avatarText: {
        color: '#fff',
        fontSize: 40,
        fontWeight: theme.typography.weights.bold,
    },
    userName: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.xl,
        fontWeight: theme.typography.weights.semibold,
    },
    userEmail: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.base,
        marginTop: theme.spacing.xs,
    },
    cardContainer: {
        marginBottom: theme.spacing.lg,
    },
    card: {
        padding: theme.spacing.lg,
    },
    cardTitle: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.semibold,
        marginBottom: theme.spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
    },
    infoIcon: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.glass.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
    },
    infoValue: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.base,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.glass.border,
        marginVertical: theme.spacing.sm,
    },
    actionsContainer: {
        marginTop: theme.spacing.md,
    },
    signOutButton: {
        borderColor: theme.colors.error,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.xl,
    },
    versionText: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
    },
});
