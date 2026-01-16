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
import { useSignUp, useSSO } from '@clerk/clerk-expo';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { VoiceOrb } from '@/components/home/VoiceOrb';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';

const { height } = Dimensions.get('window');

// Warm up the browser for OAuth on Android
WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
    useWarmUpBrowser();

    const { signUp, setActive, isLoaded } = useSignUp();
    const { startSSOFlow } = useSSO();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pendingVerification, setPendingVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Handle email/password sign-up
    const handleSignUp = async () => {
        if (!isLoaded) return;

        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert('Error', 'Please enter your first and last name');
            return;
        }

        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        try {
            await signUp.create({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                emailAddress: email.trim(),
                password,
            });

            // Send email verification code
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setPendingVerification(true);
        } catch (err: any) {
            console.error('Sign-up error:', JSON.stringify(err, null, 2));
            const errorMessage = err.errors?.[0]?.message || err.message || 'Sign-up failed. Please try again.';
            Alert.alert('Sign-up Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle email verification
    const handleVerification = async () => {
        if (!isLoaded) return;

        if (!verificationCode.trim()) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        setIsLoading(true);
        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code: verificationCode.trim(),
            });

            if (completeSignUp.status === 'complete') {
                await setActive({ session: completeSignUp.createdSessionId });
                router.replace('/(tabs)');
            } else {
                console.log('Verification requires additional steps:', completeSignUp.status);
                Alert.alert('Additional Steps Required', 'Please complete the verification process.');
            }
        } catch (err: any) {
            console.error('Verification error:', JSON.stringify(err, null, 2));
            const errorMessage = err.errors?.[0]?.message || err.message || 'Verification failed. Please try again.';
            Alert.alert('Verification Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Google OAuth sign-up
    const handleGoogleSignUp = useCallback(async () => {
        if (!isLoaded) return;

        setIsGoogleLoading(true);
        try {
            if (Platform.OS === 'web') {
                // On web, use redirect flow instead of popup
                await signUp.authenticateWithRedirect({
                    strategy: 'oauth_google',
                    redirectUrl: '/(auth)/signup',
                    redirectUrlComplete: '/(tabs)',
                });
                return;
            }

            const { createdSessionId, setActive: setActiveSession } = await startSSOFlow({
                strategy: 'oauth_google',
                redirectUrl: Linking.createURL('/(tabs)', { scheme: 'mobileapp' }),
            });

            if (createdSessionId) {
                await setActiveSession!({ session: createdSessionId });
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            if (err.code === 'ERR_REQUEST_CANCELED') {
                console.log('Google sign-up canceled');
                return;
            }
            console.error('Google sign-up error:', JSON.stringify(err, null, 2));
            const errorMessage = err.errors?.[0]?.message || err.message || 'Google sign-up failed. Please try again.';

            if (Platform.OS === 'web') {
                console.error(errorMessage);
            } else {
                Alert.alert('Google Sign-up Failed', errorMessage);
            }
        } finally {
            setIsGoogleLoading(false);
        }
    }, [isLoaded, signUp, startSSOFlow]);

    // Verification Code Screen
    if (pendingVerification) {
        return (
            <SafeAreaView style={styles.container}>
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
                        <Animated.View
                            entering={FadeInDown.delay(100).duration(600)}
                            style={styles.logoContainer}
                        >
                            <VoiceOrb size={80} state="idle" type="ring" />
                            <Text style={styles.appName}>Verify Email</Text>
                            <Text style={styles.tagline}>Enter the code sent to {email}</Text>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.delay(300).duration(600)}
                            style={styles.formContainer}
                        >
                            <GlassContainer style={styles.formCard}>
                                <Input
                                    label="Verification Code"
                                    placeholder="Enter 6-digit code"
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    keyboardType="number-pad"
                                    autoComplete="one-time-code"
                                    leftIcon={
                                        <Ionicons
                                            name="key-outline"
                                            size={20}
                                            color={theme.colors.text.muted}
                                        />
                                    }
                                />

                                <Button
                                    title="Verify Email"
                                    onPress={handleVerification}
                                    loading={isLoading}
                                    disabled={!isLoaded || isLoading}
                                    size="lg"
                                    style={styles.signInButton}
                                />

                                <TouchableOpacity
                                    style={styles.resendContainer}
                                    onPress={() => {
                                        signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
                                        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
                                    }}
                                >
                                    <Text style={styles.resendText}>Didn't receive the code? </Text>
                                    <Text style={styles.resendLink}>Resend</Text>
                                </TouchableOpacity>
                            </GlassContainer>

                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => setPendingVerification(false)}
                            >
                                <Ionicons name="arrow-back" size={20} color={theme.colors.text.muted} />
                                <Text style={styles.backText}>Back to Sign Up</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

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
                    {/* Logo */}
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(600)}
                        style={styles.logoContainer}
                    >
                        <VoiceOrb size={80} state="idle" type="ring" />
                        <Text style={styles.appName}>Create Account</Text>
                        <Text style={styles.tagline}>Start remembering everything</Text>
                    </Animated.View>

                    {/* Sign Up Form */}
                    <Animated.View
                        entering={FadeInUp.delay(300).duration(600)}
                        style={styles.formContainer}
                    >
                        <GlassContainer style={styles.formCard}>
                            <View style={styles.nameRow}>
                                <View style={styles.nameInput}>
                                    <Input
                                        label="First Name"
                                        placeholder="First"
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        autoCapitalize="words"
                                        autoComplete="given-name"
                                    />
                                </View>
                                <View style={styles.nameInput}>
                                    <Input
                                        label="Last Name"
                                        placeholder="Last"
                                        value={lastName}
                                        onChangeText={setLastName}
                                        autoCapitalize="words"
                                        autoComplete="family-name"
                                    />
                                </View>
                            </View>

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
                                placeholder="Create a password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
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

                            <Input
                                label="Confirm Password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="new-password"
                                leftIcon={
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={theme.colors.text.muted}
                                    />
                                }
                            />

                            <Button
                                title="Create Account"
                                onPress={handleSignUp}
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

                        {/* Social Sign Up */}
                        <View style={styles.socialButtons}>
                            <TouchableOpacity
                                style={[styles.socialButton, isGoogleLoading && styles.socialButtonLoading]}
                                onPress={handleGoogleSignUp}
                                disabled={!isLoaded || isLoading || isGoogleLoading}
                            >
                                {isGoogleLoading ? (
                                    <Ionicons name="sync" size={24} color={theme.colors.text.muted} />
                                ) : (
                                    <Ionicons name="logo-google" size={24} color={theme.colors.text.primary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Sign In Link */}
                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                                <Text style={styles.signUpLink}>Sign In</Text>
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
        marginBottom: theme.spacing.xl,
    },
    appName: {
        color: theme.colors.text.primary,
        fontSize: theme.typography.sizes['2xl'],
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
    nameRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    nameInput: {
        flex: 1,
    },
    signInButton: {
        marginTop: theme.spacing.md,
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
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: theme.spacing.lg,
    },
    resendText: {
        color: theme.colors.text.secondary,
        fontSize: theme.typography.sizes.sm,
    },
    resendLink: {
        color: theme.colors.primary.base,
        fontSize: theme.typography.sizes.sm,
        fontWeight: theme.typography.weights.semibold,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing.lg,
        gap: theme.spacing.xs,
    },
    backText: {
        color: theme.colors.text.muted,
        fontSize: theme.typography.sizes.base,
    },
});
