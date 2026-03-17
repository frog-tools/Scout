import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text, Chip, Icon, Surface, useTheme } from 'react-native-paper';
import { FontAwesome6 } from '@expo/vector-icons';
import Sortable from 'react-native-sortables';
import type { Album } from '../types';

function formatBounty(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  album: Album;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function AlbumCard({
  album,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
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
        isSelected && { backgroundColor: theme.colors.secondaryContainer },
      ]}
      elevation={1}
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
          {!expanded && album.redStatus && (
            <View style={styles.redBadgeRow}>
              <Chip
                icon={album.redStatus.uploaded ? 'check-circle' : 'progress-upload'}
                compact
                style={album.redStatus.uploaded ? undefined : { backgroundColor: theme.colors.secondary }}
                textStyle={styles.chipText}
              >
                {album.redStatus.uploaded ? 'Edition already on RED' : 'Uploadable'}
              </Chip>
              {album.redStatus.requests[0] && (
                <Chip icon={({ size, color }) => <FontAwesome6 name="sack-dollar" size={size - 4} color={color} />} compact textStyle={styles.chipText}>
                  {album.redStatus.requests[0].formatList} — {formatBounty(album.redStatus.requests[0].bounty)}
                </Chip>
              )}
            </View>
          )}
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
              {album.redStatus && (
                <View style={styles.redSection}>
                  <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 4 }}>
                    This edition
                  </Text>
                  <View style={styles.editionRow}>
                    <Icon
                      source={album.redStatus.uploaded ? 'check-circle' : 'progress-upload'}
                      size={14}
                      color={album.redStatus.uploaded ? theme.colors.onSurfaceVariant : theme.colors.primary}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: album.redStatus.uploaded ? theme.colors.onSurfaceVariant : theme.colors.primary }}
                    >
                      {album.redStatus.uploaded ? 'Already on RED' : 'Not uploaded'}
                    </Text>
                  </View>
                  {album.redStatus.requests[0] && (
                    <>
                      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 6 }}>
                        Request
                      </Text>
                      <View style={styles.editionRow}>
                        <FontAwesome6 name="sack-dollar" size={12} color={theme.colors.primary} />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
                          {album.redStatus.requests[0].formatList} — {formatBounty(album.redStatus.requests[0].bounty)} bounty
                        </Text>
                      </View>
                    </>
                  )}
                  {(album.redStatus.otherEditionCount ?? 0) > 0 && (
                    <>
                      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                        Other editions
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {album.redStatus.otherEditionCount} other edition{album.redStatus.otherEditionCount !== 1 ? 's' : ''} on RED
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
        {!selectionMode && (
          <Sortable.Handle>
            <View style={styles.dragHandle}>
              <Icon source="drag" size={24} color={theme.colors.onSurfaceVariant} />
            </View>
          </Sortable.Handle>
        )}
      </Pressable>
    </Surface>
  );
}

export default React.memo(AlbumCard, (prev, next) => {
  return (
    prev.album.id === next.album.id &&
    prev.album.redStatus === next.album.redStatus &&
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
  redBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  chipText: {
    fontSize: 11,
  },
  redSection: {
    marginTop: 4,
    gap: 4,
  },
  editionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },
});
