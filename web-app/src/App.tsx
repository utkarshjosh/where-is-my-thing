import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, SignIn, SignUp } from '@clerk/clerk-react';
import { LoadingOverlay, Center, Stack, Text } from '@mantine/core';
import { apiClient } from '@/api/client';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/routes/index';
import { ItemsPage } from '@/routes/items';
import { GraphPage } from '@/routes/graph';
import { ProfilePage } from '@/routes/profile';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <Center h="100vh">
        <LoadingOverlay visible />
      </Center>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

// Auth pages wrapper
function AuthPage({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <Center h="100vh">
        <LoadingOverlay visible />
      </Center>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <Center
      h="100vh"
      style={{
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
      }}
    >
      <Stack align="center" gap="xl">
        <Stack align="center" gap="xs">
          <Text size="xl" fw={700} c="white">
            Spatial Memory
          </Text>
          <Text size="sm" c="dimmed">
            Remember where you put things
          </Text>
        </Stack>
        {children}
      </Stack>
    </Center>
  );
}

// Set up API client with auth token
function AuthSetup() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  // Keep ref updated with latest getToken
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Set token getter once on mount
  useEffect(() => {
    apiClient.setTokenGetter(() => getTokenRef.current?.() ?? Promise.resolve(null));
  }, []); // Empty deps - only run once

  return null;
}

// Clean up Clerk handshake URL parameter after redirect
function ClerkHandshakeCleanup() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('__clerk_handshake')) {
      // Remove the handshake parameter and navigate to clean URL
      params.delete('__clerk_handshake');
      const newSearch = params.toString();
      const newPath = location.pathname + (newSearch ? `?${newSearch}` : '');
      navigate(newPath, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSetup />
      <ClerkHandshakeCleanup />
      <Routes>
        {/* Auth routes */}
        <Route
          path="/sign-in/*"
          element={
            <AuthPage>
              <SignIn routing="path" path="/sign-in" />
            </AuthPage>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <AuthPage>
              <SignUp routing="path" path="/sign-up" />
            </AuthPage>
          }
        />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/items" element={<ItemsPage />} />
                  <Route path="/graph" element={<GraphPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
