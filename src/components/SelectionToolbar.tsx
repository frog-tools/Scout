import React from 'react';
import { Appbar, Button, useTheme } from 'react-native-paper';

interface Props {
  count: number;
  onDelete: () => void;
  onCancel: () => void;
  onLookupRed: () => void;
  redLookupLoading: boolean;
  hasRedApiKey: boolean;
}

export default function SelectionToolbar({
  count,
  onDelete,
  onCancel,
  onLookupRed,
  redLookupLoading,
  hasRedApiKey,
}: Props) {
  const theme = useTheme();

  return (
    <Appbar.Header style={{ backgroundColor: theme.colors.elevation.level2 }}>
      <Appbar.Action icon="close" onPress={onCancel} />
      <Appbar.Content title={`${count} selected`} />
      {hasRedApiKey && (
        <Button
          mode="text"
          onPress={onLookupRed}
          loading={redLookupLoading}
          disabled={redLookupLoading || count === 0}
          icon="magnify"
          compact
        >
          Search on RED
        </Button>
      )}
      <Button mode="text" onPress={onDelete} textColor={theme.colors.error}>
        Delete
      </Button>
    </Appbar.Header>
  );
}
