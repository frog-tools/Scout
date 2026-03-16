import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button, Surface, Snackbar, ActivityIndicator, Icon, useTheme } from 'react-native-paper';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useCollection } from '../context/CollectionContext';
import { useSettings } from '../context/SettingsContext';
import { searchByBarcode, parseArtistTitle } from '../services/discogs';
import type { Album, DiscogsSearchResult } from '../types';

type ScanState = 'idle' | 'looking_up' | 'result' | 'error';

export default function ScanScreen() {
  const theme = useTheme();
  const { addAlbum, hasBarcode } = useCollection();
  const { settings } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<DiscogsSearchResult | null>(null);
  const [lastAdded, setLastAdded] = useState<Album | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const scanLockRef = useRef(false);

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setScanState('looking_up');

      try {
        if (hasBarcode(data)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setSnackbar('This CD is already in your collection');
          setScanState('idle');
          scanLockRef.current = false;
          return;
        }

        const token = settings.discogsToken || undefined;
        const results = await searchByBarcode(data, token);

        if (results.length === 0) {
          setScanState('error');
          setSnackbar('No results found for this barcode');
          setTimeout(() => {
            scanLockRef.current = false;
            setScanState('idle');
          }, 2000);
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult(results[0]);
        setScanState('result');
      } catch {
        setScanState('error');
        setSnackbar('Failed to look up barcode. Check your connection.');
        setTimeout(() => {
          scanLockRef.current = false;
          setScanState('idle');
        }, 2000);
      }
    },
    [hasBarcode, settings.discogsToken],
  );

  const handleAdd = useCallback(() => {
    if (!result) return;
    const { artist, title } = parseArtistTitle(result.title);
    const album: Album = {
      id: Crypto.randomUUID(),
      discogsId: result.id,
      barcode: '',
      title,
      artist,
      year: result.year ? parseInt(result.year, 10) : null,
      thumb: result.thumb,
      coverImage: result.cover_image,
      genre: result.genre || [],
      format: result.format || [],
      catalogNumber: result.catno || '',
      addedAt: Date.now(),
    };
    addAlbum(album);
    setLastAdded(album);
    setResult(null);
    setScanState('idle');
    scanLockRef.current = false;
    setSnackbar(`Added "${title}" to collection`);
  }, [result, addAlbum]);

  const handleDismiss = useCallback(() => {
    setResult(null);
    setScanState('idle');
    scanLockRef.current = false;
  }, []);

  if (!permission) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Icon source="camera-off" size={48} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodyLarge" style={styles.permText}>
          Camera access is needed to scan barcodes
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permButton}>
          Grant Camera Access
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={scanState === 'idle' ? handleBarcodeScanned : undefined}
        />
        {scanState === 'looking_up' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text variant="bodyLarge" style={styles.overlayText}>
              Looking up barcode...
            </Text>
          </View>
        )}
      </View>

      {scanState === 'result' && result && (
        <Surface style={styles.resultCard} elevation={2}>
          <View style={styles.resultRow}>
            {result.thumb ? (
              <Image source={{ uri: result.thumb }} style={styles.resultThumb} />
            ) : null}
            <View style={styles.resultInfo}>
              <Text variant="titleMedium" numberOfLines={2}>
                {parseArtistTitle(result.title).title}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {parseArtistTitle(result.title).artist}
              </Text>
              {result.year && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {result.year}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.resultActions}>
            <Button mode="outlined" onPress={handleDismiss}>
              Dismiss
            </Button>
            <Button mode="contained" onPress={handleAdd}>
              Add to Collection
            </Button>
          </View>
        </Surface>
      )}

      {scanState === 'idle' && !result && lastAdded && (
        <Surface style={styles.lastAdded} elevation={1}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Last added
          </Text>
          <View style={styles.resultRow}>
            {lastAdded.thumb ? (
              <Image source={{ uri: lastAdded.thumb }} style={styles.smallThumb} />
            ) : null}
            <View style={styles.resultInfo}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {lastAdded.artist} - {lastAdded.title}
              </Text>
            </View>
          </View>
        </Surface>
      )}

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permText: {
    marginTop: 16,
    textAlign: 'center',
  },
  permButton: {
    marginTop: 16,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    margin: 16,
    borderRadius: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    marginTop: 12,
  },
  resultCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultThumb: {
    width: 64,
    height: 64,
    borderRadius: 4,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  lastAdded: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 12,
  },
  smallThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginTop: 4,
  },
});
