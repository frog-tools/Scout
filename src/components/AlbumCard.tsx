import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Image, Pressable, Linking } from 'react-native';
import { Text, Chip, Icon, ActivityIndicator, Surface, useTheme } from 'react-native-paper';
import { FontAwesome6 } from '@expo/vector-icons';
import Sortable from 'react-native-sortables';
import type { Album } from '../types';

const frogGifs = [
  require('../../assets/frogs/frog1.gif'),
  require('../../assets/frogs/frog2.gif'),
  require('../../assets/frogs/frog3.gif'),
  require('../../assets/frogs/frog4.gif'),
  require('../../assets/frogs/frog5.gif'),
  require('../../assets/frogs/frog6.gif'),
  require('../../assets/frogs/frog7.gif'),
];

function formatBounty(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface Props {
  album: Album;
  expanded: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  frogModeActive: boolean;
  redSearching?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleExpand: () => void;
}

function AlbumCard({
  album,
  expanded,
  isSelected,
  selectionMode,
  frogModeActive,
  redSearching,
  onPress,
  onLongPress,
  onToggleExpand,
}: Props) {
  const theme = useTheme();
  const frogIndex = useMemo(() => Math.floor(Math.random() * frogGifs.length), []);
  const isUnofficial = album.format.some((f) => f.toLowerCase().includes('unofficial'));

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onPress();
    } else {
      onToggleExpand();
    }
  }, [selectionMode, onPress, onToggleExpand]);

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
        {frogModeActive ? (
          <Image source={frogGifs[frogIndex]} style={styles.thumb} />
        ) : album.thumb ? (
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
          {!expanded && isUnofficial && (
            <View style={styles.redBadgeRow}>
              <Chip icon="alert" compact style={{ backgroundColor: theme.dark ? '#5C2900' : '#FFE0B2' }} textStyle={styles.chipText}>
                Unofficial
              </Chip>
            </View>
          )}
          {!expanded && redSearching && (
            <View style={styles.redBadgeRow}>
              <Chip icon={({ size }) => <ActivityIndicator size={size} />} compact textStyle={styles.chipText}>
                Checking RED...
              </Chip>
            </View>
          )}
          {!expanded && !redSearching && album.redStatus && (
            <View style={styles.redBadgeRow}>
              <Chip
                icon={album.redStatus.uploaded ? 'check-circle' : 'progress-upload'}
                compact
                style={album.redStatus.uploaded ? undefined : { backgroundColor: theme.colors.secondary }}
                textStyle={styles.chipText}
              >
                {album.redStatus.uploaded ? 'Already on RED' : 'Uploadable'}
              </Chip>
              {album.redStatus.trumpable && (
                <Chip icon="chevron-double-up" compact style={{ backgroundColor: theme.dark ? '#4A3800' : '#FFF9C4' }} textStyle={styles.chipText}>
                  Trumpable
                </Chip>
              )}
              {album.redStatus.requests[0] && (
                <Chip icon={({ size, color }) => <FontAwesome6 name="sack-dollar" size={size - 4} color={color} />} compact textStyle={styles.chipText}>
                  {album.redStatus.requests[0].formatList} - {formatBounty(album.redStatus.requests[0].bounty)}
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
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >Catalog #:{' '}
                  <Text
                    style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL(`https://www.discogs.com/release/${album.discogsId}`)}
                  >
                  {album.catalogNumber}
                  </Text>
                </Text>
              )}
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Barcode: {album.barcode}
              </Text>
              {isUnofficial && (
                <View style={styles.editionRow}>
                  <Icon source="alert" size={14} color="#E65100" />
                  <Text variant="bodySmall" style={{ color: '#E65100' }}>
                    Unofficial release (see rule{' '}
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => Linking.openURL('https://redacted.sh/rules.php?p=upload#r2.1.16.3')}
                    >
                      2.1.16.3
                    </Text>
                    )
                  </Text>
                </View>
              )}
              {album.redStatus && (
                <View style={styles.redSection}>
                  <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 4 }}>
                    This edition
                  </Text>
                  <Pressable
                    style={styles.editionRow}
                    onPress={album.redStatus.matchedGroupId ? () => Linking.openURL(
                      album.redStatus!.matchedTorrentId
                        ? `https://redacted.sh/torrents.php?id=${album.redStatus!.matchedGroupId}&torrentid=${album.redStatus!.matchedTorrentId}`
                        : `https://redacted.sh/torrents.php?id=${album.redStatus!.matchedGroupId}`
                    ) : undefined}
                  >
                    <Icon
                      source={album.redStatus.uploaded ? 'check-circle' : 'progress-upload'}
                      size={14}
                      color={album.redStatus.uploaded && !album.redStatus.matchedGroupId ? theme.colors.onSurfaceVariant : theme.colors.primary}
                    />
                    <Text
                      variant="bodySmall"
                      style={{
                        color: album.redStatus.uploaded && !album.redStatus.matchedGroupId ? theme.colors.onSurfaceVariant : theme.colors.primary,
                        textDecorationLine: album.redStatus.matchedGroupId ? 'underline' : 'none',
                      }}
                    >
                      {album.redStatus.uploaded ? 'Already on RED' : 'Uploadable'}
                    </Text>
                  </Pressable>
                  {album.redStatus.trumpable && (
                    <View style={styles.editionRow}>
                      <Icon source="chevron-double-up" size={14} color="#9C7C00" />
                      <Text variant="bodySmall" style={{ color: '#9C7C00' }}>
                        Trumpable — no lossless upload
                      </Text>
                    </View>
                  )}
                  {album.redStatus.requests[0] && (
                    <>
                      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 6 }}>
                        Request
                      </Text>
                      <Pressable
                        style={styles.editionRow}
                        onPress={() => Linking.openURL(`https://redacted.sh/requests.php?action=view&id=${album.redStatus!.requests[0]!.requestId}`)}
                      >
                        <FontAwesome6 name="sack-dollar" size={12} color={theme.colors.primary} />
                        <Text variant="bodySmall" style={{ color: theme.colors.primary, flex: 1, textDecorationLine: 'underline' }}>
                          {album.redStatus.requests[0].formatList} - {formatBounty(album.redStatus.requests[0].bounty)} bounty
                        </Text>
                      </Pressable>
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
    prev.expanded === next.expanded &&
    prev.isSelected === next.isSelected &&
    prev.selectionMode === next.selectionMode &&
    prev.frogModeActive === next.frogModeActive &&
    prev.redSearching === next.redSearching
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
