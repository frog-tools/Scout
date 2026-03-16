import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { NavigationState, Route } from 'react-native-tab-view';

interface TabBarProps {
  navigationState: NavigationState<Route>;
  jumpTo: (key: string) => void;
  layout: { width: number; height: number };
  position: any;
}

export default function TabBar({ navigationState, jumpTo }: TabBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]}>
      {navigationState.routes.map((route, index) => {
        const focused = navigationState.index === index;
        return (
          <Pressable
            key={route.key}
            onPress={() => jumpTo(route.key)}
            style={styles.tab}
          >
            <Text
              variant="labelLarge"
              style={[
                styles.label,
                { color: focused ? theme.colors.primary : theme.colors.onSurfaceVariant },
              ]}
            >
              {route.title}
            </Text>
            {focused && (
              <View
                style={[styles.indicator, { backgroundColor: theme.colors.primary }]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '50%',
    borderRadius: 1.5,
  },
});
