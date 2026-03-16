import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text, Icon, Surface, useTheme } from 'react-native-paper';
import type { Album } from '../types';

interface Props {
  album: Album;
  isActive: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDragHandle?: () => void;
}

function AlbumCard({
  album,
  isActive,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
  onDragHandle,
}: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onPress();
    } else {
      setExpanded((prev) => !prev);
    }
  }, [selectionMode, onPress]);

  return (
    <Surface
      style={[
        styles.surface,
        isActive && { elevation: 4, opacity: 0.9 },
        isSelected && { backgroundColor: theme.colors.secondaryContainer },
      ]}
      elevation={isActive ? 4 : 1}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={styles.row}
      >
        {selectionMode && (
          <View style={styles.checkbox}>
            <Icon
              source={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </View>
        )}
        {album.thumb ? (
          <Image source={{ uri: album.thumb }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon source="album" size={28} color={theme.colors.onSurfaceVariant} />
          </View>
        )}
        <View style={styles.info}>
          <Text variant="titleMedium" numberOfLines={1}>
            {album.title}
          </Text>
          <Text variant="bodyMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {album.artist}
          </Text>
          {expanded && (
            <View style={styles.expanded}>
              {album.year != null && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Year: {album.year}
                </Text>
              )}
              {album.format.length > 0 && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Format: {album.format.join(', ')}
                </Text>
              )}
              {album.genre.length > 0 && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Genre: {album.genre.join(', ')}
                </Text>
              )}
              {album.catalogNumber !== '' && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Catalog #: {album.catalogNumber}
                </Text>
              )}
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Barcode: {album.barcode}
              </Text>
            </View>
          )}
        </View>
        {!selectionMode && (
          <Pressable onPressIn={onDragHandle} hitSlop={8} style={styles.dragHandle}>
            <Icon source="drag" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        )}
      </Pressable>
    </Surface>
  );
}

export default React.memo(AlbumCard, (prev, next) => {
  return (
    prev.album.id === next.album.id &&
    prev.isActive === next.isActive &&
    prev.isSelected === next.isSelected &&
    prev.selectionMode === next.selectionMode
  );
});

const styles = StyleSheet.create({
  surface: {
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  checkbox: {
    marginRight: 8,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 4,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  expanded: {
    marginTop: 8,
    gap: 2,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },
});
