import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, ColorSchemeScript, Center, Stack, Text, Code, Button, Paper } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { theme } from '@/theme';
import App from './App';

// Mantine styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

// Clerk publishable key
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Missing Clerk key warning component
function MissingClerkKey() {
  return (
    <Center h="100vh" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)' }}>
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          maxWidth: 500,
        }}
      >
        <Stack align="center" gap="md">
          <Text size="xl" fw={700} c="white">
            Configuration Required
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            To use Spatial Memory, you need to configure your Clerk publishable key.
          </Text>
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              width: '100%',
            }}
          >
            <Code block style={{ background: 'transparent' }}>
              {`# Create a .env file in web-app/\nVITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key`}
            </Code>
          </Paper>
          <Text size="xs" c="dimmed">
            Get your key from{' '}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#f59e0b' }}
            >
              dashboard.clerk.com
            </a>
          </Text>
          <Button
            variant="light"
            color="amber"
            onClick={() => window.location.reload()}
          >
            Refresh after adding key
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      {!CLERK_PUBLISHABLE_KEY ? (
        <MissingClerkKey />
      ) : (
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          appearance={{
            baseTheme: undefined,
            variables: {
              colorPrimary: '#f59e0b',
              colorBackground: '#1a1b1e',
              colorText: '#ffffff',
              colorTextSecondary: '#a6a7ab',
              colorInputBackground: '#25262b',
              colorInputText: '#ffffff',
              borderRadius: '12px',
            },
            elements: {
              card: {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
              },
              formButtonPrimary: {
                backgroundColor: '#f59e0b',
                '&:hover': {
                  backgroundColor: '#d97706',
                },
              },
              socialButtonsBlockButton__google: {
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              },
              socialButtonsBlockButtonText__google: {
                color: '#ffffff !important',
              },
            },
          }}
        >
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ClerkProvider>
      )}
    </MantineProvider>
  </React.StrictMode>
);
