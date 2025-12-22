import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import theme from '@/constants/theme';
import { GlassContainer } from '@/components/ui/GlassContainer';
import { Button } from '@/components/ui/Button';

export default function ProfileModal() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <GlassContainer style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={theme.colors.primary.base} />
        </View>
        <Text style={styles.name}>User</Text>
        <Text style={styles.email}>user@example.com</Text>
      </GlassContainer>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <GlassContainer style={styles.statCard}>
          <Text style={styles.statValue}>24</Text>
          <Text style={styles.statLabel}>Items</Text>
        </GlassContainer>
        <GlassContainer style={styles.statCard}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Locations</Text>
        </GlassContainer>
        <GlassContainer style={styles.statCard}>
          <Text style={styles.statValue}>56</Text>
          <Text style={styles.statLabel}>Queries</Text>
        </GlassContainer>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Settings"
          variant="secondary"
          onPress={() => console.log('Settings')}
          icon={<Ionicons name="settings-outline" size={20} color={theme.colors.primary.base} />}
        />
        <Button
          title="Sign Out"
          variant="ghost"
          onPress={() => router.replace('/(auth)/login')}
          icon={<Ionicons name="log-out-outline" size={20} color={theme.colors.text.secondary} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  profileCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.glass.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary.base,
  },
  name: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
  },
  email: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.base,
    marginTop: theme.spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  statValue: {
    color: theme.colors.primary.base,
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
  },
  statLabel: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.xs,
  },
  actions: {
    gap: theme.spacing.md,
  },
});
