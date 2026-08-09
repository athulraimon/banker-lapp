import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function TabLayout() {
  const isAdmin = useAuthStore((s) => s.user?.is_admin);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(23, 21, 18, 0.96)',
          borderTopColor: colors.borderColor,
        },
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: 'Jost-SemiBold', letterSpacing: 0.5 },
        sceneStyle: { backgroundColor: colors.bgCarbon },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Races',
          tabBarIcon: ({ color, size }) => <Ionicons name="flag" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="standings"
        options={{
          title: 'Standings',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          tabBarIcon: ({ color, size }) => <Ionicons name="help-circle" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" color={color} size={size} />,
          // Hide the Admin tab entirely for non-admins (href: null removes it).
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
