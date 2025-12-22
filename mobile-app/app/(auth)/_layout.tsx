import React from 'react';
import { Stack } from 'expo-router';

import theme from '@/constants/theme';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background.primary },
                animation: 'fade',
            }}
        >
            <Stack.Screen name="login" />
            <Stack.Screen name="tour" />
        </Stack>
    );
}
