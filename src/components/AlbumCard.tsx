import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text, Chip, Icon, Surface, useTheme } from 'react-native-paper';
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
                icon={album.redStatus.uploaded ? 'close-circle' : 'party-popper'}
                compact
                style={album.redStatus.uploaded ? undefined : styles.chipNotUploaded }
                textStyle={styles.chipText}
              >
                {album.redStatus.uploaded ? 'On RED' : 'Not on RED'}
              </Chip>
              {album.redStatus.requestCount > 0 && (
                <Chip icon="grin-stars" compact textStyle={styles.chipText}>
                  {album.redStatus.requestCount}
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
                    RED Status
                  </Text>
                  {album.redStatus.uploaded ? (
                    album.redStatus.editions.map((e) => (
                      <Text
                        key={e.torrentId}
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {e.format} {e.encoding} ({e.media})
                        {e.remasterCatalogueNumber ? ` [${e.remasterCatalogueNumber}]` : ''}
                        {' '}- {e.seeders} seed{e.seeders !== 1 ? 's' : ''}, {e.snatched} snatch{e.snatched !== 1 ? 'es' : ''}
                      </Text>
                    ))
                  ) : (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Not uploaded
                    </Text>
                  )}
                  {album.redStatus.requests.map((r) => (
                    <Text
                      key={r.requestId}
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Request: {r.formatList} - {formatBounty(r.bounty)} bounty
                    </Text>
                  ))}
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
  chipNotUploaded: {
    backgroundColor: '#c8e6c9',
  },
  chipText: {
    fontSize: 11,
  },
  redSection: {
    marginTop: 4,
    gap: 2,
  },
  dragHandle: {
    padding: 8,
    marginLeft: 4,
  },
});
