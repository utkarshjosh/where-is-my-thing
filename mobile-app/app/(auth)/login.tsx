import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
    FadeInDown,
    FadeInUp,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSignIn, useSSO } from '@clerk/clerk-expo';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VoiceOrb } from '@/components/home/VoiceOrb';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';

const { height } = Dimensions.get('window');

// Warm up the browser for OAuth on Android
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    useWarmUpBrowser();

    const { signIn, setActive, isLoaded } = useSignIn();
    const { startSSOFlow } = useSSO();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Handle email/password sign-in
    const handleLogin = async () => {
        if (!isLoaded) return;

        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            const signInAttempt = await signIn.create({
                identifier: email.trim(),
                password,
            });

            if (signInAttempt.status === 'complete') {
                await setActive({ session: signInAttempt.createdSessionId });
                router.replace('/(tabs)');
            } else {
                // Handle additional steps if needed (e.g., MFA)
                console.log('Sign-in requires additional steps:', signInAttempt.status);
                Alert.alert('Additional Steps Required', 'Please check your email or complete additional verification.');
            }
        } catch (err: any) {
            console.error('Sign-in error:', JSON.stringify(err, null, 2));
            const errorMessage = err.errors?.[0]?.message || err.message || 'Sign-in failed. Please try again.';
            Alert.alert('Sign-in Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Google OAuth sign-in
    const handleGoogleLogin = useCallback(async () => {
        if (!isLoaded) return;

        setIsGoogleLoading(true);
        try {
            const { createdSessionId, setActive: setActiveSession } = await startSSOFlow({
                strategy: 'oauth_google',
                redirectUrl: Linking.createURL('/(tabs)', { scheme: 'mobileapp' }),
            });

            if (createdSessionId) {
                await setActiveSession!({ session: createdSessionId });
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            // User canceled or error occurred
            if (err.code === 'ERR_REQUEST_CANCELED') {
                console.log('Google sign-in canceled');
                return;
            }
            console.error('Google sign-in error:', JSON.stringify(err, null, 2));
            const errorMessage = err.errors?.[0]?.message || err.message || 'Google sign-in failed. Please try again.';
            Alert.alert('Google Sign-in Failed', errorMessage);
        } finally {
            setIsGoogleLoading(false);
        }
    }, [isLoaded, startSSOFlow]);

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
                                autoComplete="email"
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
                                autoComplete="password"
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
                                disabled={!isLoaded || isLoading || isGoogleLoading}
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
                                style={[styles.socialButton, isGoogleLoading && styles.socialButtonLoading]}
                                onPress={handleGoogleLogin}
                                disabled={!isLoaded || isLoading || isGoogleLoading}
                            >
                                {isGoogleLoading ? (
                                    <Ionicons name="sync" size={24} color={theme.colors.text.muted} />
                                ) : (
                                    <Ionicons name="logo-google" size={24} color={theme.colors.text.primary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Sign Up Link */}
                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                                <Text style={styles.signUpLink}>Sign Up</Text>
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
    socialButtonLoading: {
        opacity: 0.6,
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
