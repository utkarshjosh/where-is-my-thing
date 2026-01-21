import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  NavLink,
  Text,
  Avatar,
  Menu,
  UnstyledButton,
  Box,
  Divider,
  Stack,
  rem,
  Center,
  Paper,
  Progress,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconHome,
  IconBox,
  IconShare,
  IconUser,
  IconLogout,
  IconChevronDown,
  IconClock,
} from '@tabler/icons-react';
import { useRateLimitStore } from '@/stores/rateLimitStore';

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Home', icon: IconHome },
  { path: '/items', label: 'Items', icon: IconBox },
  { path: '/graph', label: 'Graph', icon: IconShare },
];

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { rateLimitUntil, rateLimitDurationSeconds, rateLimitMessage, clearRateLimit } =
    useRateLimitStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!rateLimitUntil) {
      return;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [rateLimitUntil]);

  const remainingMs = useMemo(() => {
    if (!rateLimitUntil) {
      return 0;
    }
    return Math.max(0, rateLimitUntil - now);
  }, [rateLimitUntil, now]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isRateLimited = Boolean(rateLimitUntil && remainingMs > 0);
  const progressValue = useMemo(() => {
    if (!rateLimitDurationSeconds || rateLimitDurationSeconds <= 0) {
      return 0;
    }
    const elapsed = rateLimitDurationSeconds - remainingSeconds;
    return Math.min(100, Math.max(0, (elapsed / rateLimitDurationSeconds) * 100));
  }, [rateLimitDurationSeconds, remainingSeconds]);

  useEffect(() => {
    if (rateLimitUntil && remainingMs <= 0) {
      clearRateLimit();
    }
  }, [rateLimitUntil, remainingMs, clearRateLimit]);

  const handleSignOut = () => {
    signOut();
  };

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding={isMobile ? 0 : "md"}
      styles={{
        main: {
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingTop: 'var(--app-shell-header-offset)',
          paddingBottom: '0',
          paddingLeft: 'var(--app-shell-navbar-offset)',
          paddingRight: '0',
        },
        header: {
          background: 'rgba(15, 15, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
        navbar: {
          background: 'rgba(15, 15, 15, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="white"
            />
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Group gap="xs">
                <Box
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBox size={20} color="white" />
                </Box>
                <Text fw={700} size="lg" c="white">
                  Spatial Memory
                </Text>
              </Group>
            </Link>
          </Group>

          {/* Desktop: Show in header */}
          {!isMobile && (
            <Group gap="sm">
              <Menu position="bottom-end" shadow="lg" width={200}>
                <Menu.Target>
                  <UnstyledButton
                    style={{
                      padding: '4px 8px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Avatar
                      src={user?.imageUrl}
                      alt={user?.fullName || 'User'}
                      size={32}
                      radius="xl"
                    />
                    <Text size="sm" c="white" fw={500}>
                      {user?.firstName || 'User'}
                    </Text>
                    <IconChevronDown size={14} color="gray" />
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Account</Menu.Label>
                  <Menu.Item
                    component={Link}
                    to="/profile"
                    leftSection={<IconUser size={16} />}
                  >
                    Profile
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={handleSignOut}
                  >
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        <Stack gap="xs">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                component={Link}
                to={item.path}
                label={item.label}
                leftSection={<item.icon size={20} />}
                active={isActive}
                onClick={() => isMobile && close()}
                styles={(theme) => ({
                  root: {
                    borderRadius: rem(8),
                    ...(isActive && {
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      '&:hover': {
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      },
                    }),
                    ...(!isActive && {
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }),
                  },
                  label: {
                    fontWeight: 500,
                  },
                })}
              />
            );
          })}

          <Divider my="sm" color="rgba(255, 255, 255, 0.08)" />

          {/* Mobile: Profile in sidebar */}
          {isMobile && (
            <>
              <Stack gap={6}>
                <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: rem(1) }}>
                  Account
                </Text>
                <Group gap="xs">
                  <Avatar
                    src={user?.imageUrl}
                    alt={user?.fullName || 'User'}
                    size={28}
                    radius="xl"
                  />
                  <Text size="sm" c="white" fw={500}>
                    {user?.firstName || 'User'}
                  </Text>
                </Group>
                <NavLink
                  component={Link}
                  to="/profile"
                  label="Profile"
                  leftSection={<IconUser size={18} />}
                  onClick={() => close()}
                  styles={{
                    root: {
                      borderRadius: rem(8),
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    },
                    label: {
                      fontWeight: 500,
                    },
                  }}
                />
                <NavLink
                  label="Sign out"
                  leftSection={<IconLogout size={18} />}
                  onClick={() => {
                    handleSignOut();
                    close();
                  }}
                  styles={{
                    root: {
                      borderRadius: rem(8),
                      color: 'var(--mantine-color-red-6)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    },
                    label: {
                      fontWeight: 500,
                    },
                  }}
                />
              </Stack>
            </>
          )}

          {/* Desktop: Profile link */}
          {!isMobile && (() => {
            const isProfileActive = location.pathname === '/profile';
            return (
              <NavLink
                component={Link}
                to="/profile"
                label="Profile"
                leftSection={<IconUser size={20} />}
                active={isProfileActive}
                styles={(theme) => ({
                  root: {
                    borderRadius: rem(8),
                    ...(isProfileActive && {
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                    }),
                    ...(!isProfileActive && {
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }),
                  },
                  label: {
                    fontWeight: 500,
                  },
                })}
              />
            );
          })()}
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        {children}
        {isRateLimited && (
          <Box
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <Center h="100%">
              <Paper
                radius="lg"
                p="xl"
                style={{
                  width: 'min(520px, 92vw)',
                  background: 'rgba(15, 15, 15, 0.92)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Stack gap="md">
                  <Group gap="sm">
                    <IconClock size={22} color="#f59e0b" />
                    <Text size="lg" fw={700} c="white">
                      Rate limit reached
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    We are on the Groq free tier. Please slow down and wait about a minute before
                    trying again.
                  </Text>
                  {rateLimitMessage && (
                    <Text size="xs" c="dimmed">
                      {rateLimitMessage}
                    </Text>
                  )}
                  <Stack gap={6}>
                    <Text size="sm" c="white">
                      Try again in {remainingSeconds}s
                    </Text>
                    <Progress value={progressValue} color="amber" size="md" radius="xl" />
                  </Stack>
                </Stack>
              </Paper>
            </Center>
          </Box>
        )}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
