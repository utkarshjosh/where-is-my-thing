import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

import theme from '@/constants/theme';

export default function AuthLayout() {
    const { isSignedIn, isLoaded } = useAuth();

    // While Clerk is loading, don't render anything
    if (!isLoaded) {
        return null;
    }

    // Redirect signed-in users to main app
    if (isSignedIn) {
        return <Redirect href="/(tabs)" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background.primary },
                animation: 'fade',
            }}
        >
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="tour" />
        </Stack>
    );
}
