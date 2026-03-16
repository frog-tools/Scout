import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

interface Props {
  count: number;
  onDelete: () => void;
  onCancel: () => void;
}

export default function SelectionToolbar({ count, onDelete, onCancel }: Props) {
  const theme = useTheme();
  return (
    <Appbar.Header style={{ backgroundColor: theme.colors.elevation.level2 }}>
      <Appbar.Action icon="close" onPress={onCancel} />
      <Appbar.Content title={`${count} selected`} />
      <Button mode="text" onPress={onDelete} textColor={theme.colors.error}>
        Delete
      </Button>
    </Appbar.Header>
  );
}
