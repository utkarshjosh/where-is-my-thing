import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
    FadeInDown,
    FadeInUp,
} from 'react-native-reanimated';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VoiceOrb } from '@/components/home/VoiceOrb';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        setIsLoading(true);
        // Simulate login
        setTimeout(() => {
            setIsLoading(false);
            router.replace('/(tabs)');
        }, 1500);
    };

    const handleSocialLogin = (provider: string) => {
        console.log('Login with:', provider);
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Background gradient */}
            <LinearGradient
                colors={['rgba(139, 92, 246, 0.15)', 'transparent', 'rgba(99, 102, 241, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo / Skia Orb */}
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(600)}
                        style={styles.logoContainer}
                    >
                        <VoiceOrb size={100} state="idle" type="ring" />
                        <Text style={styles.appName}>Spatial Memory</Text>
                        <Text style={styles.tagline}>Remember everything, everywhere</Text>
                    </Animated.View>

                    {/* Login Form */}
                    <Animated.View
                        entering={FadeInUp.delay(300).duration(600)}
                        style={styles.formContainer}
                    >
                        <GlassContainer style={styles.formCard}>
                            <Text style={styles.formTitle}>Welcome Back</Text>

                            <Input
                                label="Email"
                                placeholder="Enter your email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                leftIcon={
                                    <Ionicons
                                        name="mail-outline"
                                        size={20}
                                        color={theme.colors.text.muted}
                                    />
                                }
                            />

                            <Input
                                label="Password"
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                leftIcon={
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={theme.colors.text.muted}
                                    />
                                }
                                rightIcon={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Ionicons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color={theme.colors.text.muted}
                                        />
                                    </TouchableOpacity>
                                }
                            />

                            <TouchableOpacity style={styles.forgotPassword}>
                                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                            </TouchableOpacity>

                            <Button
                                title="Sign In"
                                onPress={handleLogin}
                                loading={isLoading}
                                size="lg"
                                style={styles.signInButton}
                            />
                        </GlassContainer>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Login */}
                        <View style={styles.socialButtons}>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => handleSocialLogin('google')}
                            >
                                <Ionicons name="logo-google" size={24} color={theme.colors.text.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.socialButton}
                                onPress={() => handleSocialLogin('apple')}
                            >
                                <Ionicons name="logo-apple" size={24} color={theme.colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {/* Sign Up Link */}
                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/tour')}>
                                <Text style={styles.signUpLink}>Get Started</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background.primary,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.xl,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing['2xl'],
    },
    miniOrb: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
        marginBottom: theme.spacing.md,
        shadowColor: theme.colors.primary.base,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    orbGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    orbHighlight: {
        position: 'absolute',
        top: 10,
        left: 15,
        width: 25,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '-20deg' }],
    },
    appName: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes['3xl'],
        fontWeight: theme.typography.weights.bold,
    },
    tagline: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.base,
        marginTop: theme.spacing.xs,
    },
    formContainer: {
        width: '100%',
    },
    formCard: {
        padding: theme.spacing.lg,
    },
    formTitle: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes.xl,
        fontWeight: theme.typography.weights.semibold,
        marginBottom: theme.spacing.lg,
        textAlign: 'center',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: theme.spacing.md,
    },
    forgotPasswordText: {
        color: theme.colors.primary.base,
        fontSize: theme.typography.sizes.sm,
    },
    signInButton: {
        marginTop: theme.spacing.sm,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.glass.border,
    },
    dividerText: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.sm,
        marginHorizontal: theme.spacing.md,
    },
    socialButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: theme.spacing.md,
    },
    socialButton: {
        width: 56,
        height: 56,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.glass.background,
        borderWidth: 1,
        borderColor: theme.colors.glass.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: theme.spacing.xl,
    },
    signUpText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.base,
    },
    signUpLink: {
        color: theme.colors.primary.base,
        fontSize: theme.typography.sizes.base,
        fontWeight: theme.typography.weights.semibold,
    },
});
