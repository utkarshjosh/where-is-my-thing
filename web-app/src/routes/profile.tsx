import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Box,
  Paper,
  Text,
  Group,
  Stack,
  Avatar,
  Button,
  Divider,
  ThemeIcon,
  Switch,
  Badge,
} from '@mantine/core';
import {
  IconMail,
  IconLogout,
  IconBell,
  IconVolume,
  IconMicrophone,
  IconTrash,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useChatStore } from '@/stores/chatStore';

export function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { clearTranscripts, transcripts } = useChatStore();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleSignOut = async () => {
    await signOut();
  };

  const handleClearHistory = () => {
    clearTranscripts();
    notifications.show({
      title: 'History Cleared',
      message: 'Your chat history has been cleared.',
      color: 'green',
    });
  };

  if (!isLoaded) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed">Loading...</Text>
      </Box>
    );
  }

  return (
    <Box maw={isMobile ? 600 : '100%'} mx="auto" px={isMobile ? 0 : 'md'}>
      {/* Profile Header */}
      <Paper
        p="xl"
        radius="lg"
        mb="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Group align="flex-start">
          <Avatar
            src={user?.imageUrl}
            alt={user?.fullName || 'User'}
            size={80}
            radius="xl"
          />
          <Stack gap={4} style={{ flex: 1 }}>
            <Text size="xl" fw={700}>
              {user?.fullName || 'User'}
            </Text>
            <Group gap="xs">
              <IconMail size={14} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {user?.primaryEmailAddress?.emailAddress || 'No email'}
              </Text>
            </Group>
            <Badge size="sm" variant="light" color="green" mt="xs">
              Active Account
            </Badge>
          </Stack>
        </Group>
      </Paper>

      {/* App Settings */}
      <Paper
        p="lg"
        radius="lg"
        mb="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Text size="sm" fw={600} mb="md">
          App Settings
        </Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                <IconVolume size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={500}>
                  Audio Responses
                </Text>
                <Text size="xs" c="dimmed">
                  Play voice responses
                </Text>
              </Box>
            </Group>
            <Switch defaultChecked color="amber" />
          </Group>

          <Divider color="rgba(255, 255, 255, 0.06)" />

          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                <IconMicrophone size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={500}>
                  Voice Input
                </Text>
                <Text size="xs" c="dimmed">
                  Enable voice commands
                </Text>
              </Box>
            </Group>
            <Switch defaultChecked color="amber" />
          </Group>

          <Divider color="rgba(255, 255, 255, 0.06)" />

          {/* Notifications - Commented out */}
          {/* <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                <IconBell size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={500}>
                  Notifications
                </Text>
                <Text size="xs" c="dimmed">
                  Browser notifications
                </Text>
              </Box>
            </Group>
            <Switch color="amber" />
          </Group> */}
        </Stack>
      </Paper>

      {/* Data Management - Commented out */}
      {/* <Paper
        p="lg"
        radius="lg"
        mb="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Text size="sm" fw={600} mb="md">
          Data Management
        </Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" radius="md" variant="light" color="gray">
                <IconTrash size={18} />
              </ThemeIcon>
              <Box>
                <Text size="sm" fw={500}>
                  Clear Chat History
                </Text>
                <Text size="xs" c="dimmed">
                  {transcripts.length} messages in current session
                </Text>
              </Box>
            </Group>
            <Button
              variant="light"
              color="red"
              size="xs"
              onClick={handleClearHistory}
              disabled={transcripts.length === 0}
            >
              Clear
            </Button>
          </Group>
        </Stack>
      </Paper> */}

      {/* Sign Out */}
      <Paper
        p="lg"
        radius="lg"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Button
          fullWidth
          variant="light"
          color="red"
          size="md"
          leftSection={<IconLogout size={18} />}
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </Paper>

      {/* Version Info */}
      <Text size="xs" c="dimmed" ta="center" mt="lg">
        Spatial Memory v1.0.0
      </Text>
    </Box>
  );
}

