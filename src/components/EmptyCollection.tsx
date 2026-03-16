import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function EmptyCollection() {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        No CDs yet
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Swipe to the Scan tab to scan your first CD barcode
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});
