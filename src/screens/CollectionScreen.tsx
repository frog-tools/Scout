import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, BackHandler, View } from 'react-native';
import { Snackbar, useTheme } from 'react-native-paper';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { useCollection } from '../context/CollectionContext';
import AlbumCard from '../components/AlbumCard';
import SelectionToolbar from '../components/SelectionToolbar';
import EmptyCollection from '../components/EmptyCollection';
import type { Album } from '../types';

export default function CollectionScreen() {
  const { albums, removeAlbums, reorder } = useCollection();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState('');
  const theme = useTheme();

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Handle back button/gesture to exit selection mode
  useEffect(() => {
    if (!selectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitSelectionMode();
      return true;
    });
    return () => sub.remove();
  }, [selectionMode, exitSelectionMode]);

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

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

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<Album>) => (
      <AlbumCard
        album={item}
        isActive={isActive}
        isSelected={selectedIds.has(item.id)}
        selectionMode={selectionMode}
        onPress={() => (selectionMode ? toggleSelect(item.id) : undefined)}
        onLongPress={() => !selectionMode && enterSelectionMode(item.id)}
        onDragHandle={selectionMode ? undefined : drag}
      />
    ),
    [selectionMode, selectedIds, toggleSelect, enterSelectionMode],
  );

  const keyExtractor = useCallback((item: Album) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {selectionMode && (
        <SelectionToolbar
          count={selectedIds.size}
          onDelete={handleDelete}
          onCancel={exitSelectionMode}
        />
      )}
      {albums.length === 0 ? (
        <EmptyCollection />
      ) : (
        <DraggableFlatList
          data={albums}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorder(data)}
          onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activationDistance={selectionMode ? 999 : 10}
          contentContainerStyle={styles.list}
        />
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
