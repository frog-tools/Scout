import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, BackHandler, View } from 'react-native';
import { Appbar, Snackbar, useTheme } from 'react-native-paper';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';
import * as Haptics from 'expo-haptics';
import { useCollection } from '../context/CollectionContext';
import { useSettings } from '../context/SettingsContext';
import { getRedStatus } from '../services/redacted';
import AlbumCard from '../components/AlbumCard';
import SelectionToolbar from '../components/SelectionToolbar';
import CollectionMenu from '../components/CollectionMenu';
import EmptyCollection from '../components/EmptyCollection';
import type { Album } from '../types';

export default function CollectionScreen() {
  const { albums, removeAlbums, reorder, updateAlbum } = useCollection();
  const { settings } = useSettings();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState('');
  const [redLookupLoading, setRedLookupLoading] = useState(false);
  const theme = useTheme();

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (!selectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelectionMode();
      return true;
    });
    return () => sub.remove();
  }, [selectionMode, exitSelectionMode]);

  const enterSelectionWithIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return false;
    setSelectionMode(true);
    setSelectedIds(new Set(ids));
    return true;
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    enterSelectionWithIds([id]);
  }, [enterSelectionWithIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) {
          setSelectionMode(false);
          return new Set();
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(() => {
    const count = selectedIds.size;
    removeAlbums(Array.from(selectedIds));
    exitSelectionMode();
    setSnackbar(`Deleted ${count} item${count > 1 ? 's' : ''}`);
  }, [selectedIds, removeAlbums, exitSelectionMode]);

  const handleSelectAll = useCallback(() => {
    enterSelectionWithIds(albums.map((a) => a.id));
  }, [albums, enterSelectionWithIds]);

  const handleSelectNotOnRed = useCallback(() => {
    const ids = albums.filter((a) => a.redStatus && !a.redStatus.uploaded).map((a) => a.id);
    if (!enterSelectionWithIds(ids)) {
      setSnackbar('No items are marked as not on RED');
    }
  }, [albums, enterSelectionWithIds]);

  const handleSelectNoRedStatus = useCallback(() => {
    const ids = albums.filter((a) => !a.redStatus).map((a) => a.id);
    if (!enterSelectionWithIds(ids)) {
      setSnackbar('All items have been checked on RED');
    }
  }, [albums, enterSelectionWithIds]);

  const handleLookupRed = useCallback(async () => {
    const apiKey = settings.redApiKey;
    if (!apiKey) return;

    const selected = albums.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return;

    setRedLookupLoading(true);
    let updated = 0;

    for (const album of selected) {
      try {
        const status = await getRedStatus(
          album.artist,
          album.title,
          album.catalogNumber,
          apiKey,
        );
        updateAlbum(album.id, { redStatus: status });
        updated++;
      } catch {
        // Continue with remaining items on failure
      }
    }

    setRedLookupLoading(false);
    setSnackbar(`Updated RED status for ${updated} item${updated !== 1 ? 's' : ''}`);
  }, [albums, selectedIds, settings.redApiKey, updateAlbum]);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const renderItem = useCallback<SortableGridRenderItem<Album>>(
    ({ item }) => (
      <AlbumCard
        album={item}
        isSelected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={() => (selectionMode ? toggleSelect(item.id) : undefined)}
        onLongPress={() => !selectionMode && enterSelectionMode(item.id)}
      />
    ),
    [selectionMode, selectedIds, toggleSelect, enterSelectionMode],
  );

  const keyExtractor = useCallback((item: Album) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View>
        <Appbar.Header style={{ backgroundColor: theme.colors.elevation.level2 }}>
          <Appbar.Content title="Collection" />
          <CollectionMenu
            onSelectAll={handleSelectAll}
            onSelectNotOnRed={handleSelectNotOnRed}
            onSelectNoRedStatus={handleSelectNoRedStatus}
            hasRedApiKey={!!settings.redApiKey}
            hasAlbums={albums.length > 0}
          />
        </Appbar.Header>
        {selectionMode && (
          <View style={StyleSheet.absoluteFill}>
            <SelectionToolbar
              count={selectedIds.size}
              onDelete={handleDelete}
              onCancel={exitSelectionMode}
              onLookupRed={handleLookupRed}
              redLookupLoading={redLookupLoading}
              hasRedApiKey={!!settings.redApiKey}
            />
          </View>
        )}
      </View>
      {albums.length === 0 ? (
        <EmptyCollection />
      ) : (
        <Animated.ScrollView
          ref={scrollRef}
          style={{ backgroundColor: theme.colors.background }}
          contentContainerStyle={styles.list}
        >
          <Sortable.Grid
            data={albums}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            columns={1}
            scrollableRef={scrollRef}
            customHandle
            dragActivationDelay={0}
            sortEnabled={!selectionMode}
            activeItemScale={1}
            activeItemOpacity={0.9}
            activeItemShadowOpacity={0.3}
            inactiveItemOpacity={1}
            onDragStart={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            onDragEnd={({ fromIndex, toIndex }) => {
              if (fromIndex !== toIndex) reorder(fromIndex, toIndex);
            }}
          />
        </Animated.ScrollView>
      )}
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingVertical: 8,
  },
});
