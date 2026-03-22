import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button, Chip, Surface, Snackbar, ActivityIndicator, Icon, useTheme } from 'react-native-paper';
import { FontAwesome6 } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { useCollection } from '../context/CollectionContext';
import { useSettings } from '../context/SettingsContext';
import { searchByBarcode, parseArtistTitle, fetchReleaseDetail, fetchReleaseImages } from '../services/discogs';
import { getRedStatus } from '../services/redacted';
import ReleasePicker from '../components/ReleasePicker';
import type { Album, DiscogsSearchResult, DiscogsReleaseDetail, RedStatus } from '../types';

type ScanState = 'idle' | 'looking_up' | 'disambiguate' | 'result' | 'error';

function patchSearchResultImages(
  hit: DiscogsSearchResult,
  detail: DiscogsReleaseDetail,
): void {
  if (!hit.thumb && !hit.cover_image && detail.images?.length) {
    const primary = detail.images.find((img) => img.type === 'primary') ?? detail.images[0];
    hit.thumb = primary?.uri150 ?? '';
    hit.cover_image = primary?.uri ?? '';
  }
}

export default function ScanScreen() {
  const theme = useTheme();
  const { addAlbum, hasBarcode } = useCollection();
  const { settings, setFrogMode } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<DiscogsSearchResult | null>(null);
  const [lastAdded, setLastAdded] = useState<Album | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const scanLockRef = useRef(false);
  const scannedBarcodeRef = useRef('');
  const [redStatus, setRedStatus] = useState<RedStatus | null>(null);
  const [redLoading, setRedLoading] = useState(false);
  const [releaseDetail, setReleaseDetail] = useState<DiscogsReleaseDetail | null>(null);
  const [candidates, setCandidates] = useState<DiscogsSearchResult[]>([]);
  const [coverMap, setCoverMap] = useState<Map<number, string>>(new Map());

  // Fetch RED status when release detail is available
  useEffect(() => {
    if (!releaseDetail || !settings.redApiKey) {
      setRedStatus(null);
      return;
    }
    let cancelled = false;
    setRedLoading(true);
    getRedStatus(releaseDetail, settings.redApiKey)
      .then((status) => { if (!cancelled) setRedStatus(status); })
      .catch(() => { if (!cancelled) setRedStatus(null); })
      .finally(() => { if (!cancelled) setRedLoading(false); });
    return () => { cancelled = true; };
  }, [releaseDetail, settings.redApiKey]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      scannedBarcodeRef.current = data;

      if (data === '682110000004') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setFrogMode(true);
        setSnackbar('Ribbit! Frog mode activated!');
        setScanState('idle');
        scanLockRef.current = false;
        return;
      }

      setScanState('looking_up');

      try {
        if (hasBarcode(data)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setSnackbar('This edition is already in your collection');
          setScanState('idle');
          scanLockRef.current = false;
          return;
        }

        const token = settings.discogsToken || undefined;
        const results = await searchByBarcode(data, token);

        if (results.filter((r) => r.type === 'release').length === 0) {
          setScanState('error');
          setSnackbar('No results found for this barcode');
          setTimeout(() => {
            scanLockRef.current = false;
            setScanState('idle');
          }, 2000);
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const releases = results.filter((r) => r.type === 'release');

        if (releases.length === 0) {
          setScanState('error');
          setSnackbar('No results found for this barcode');
          setTimeout(() => {
            scanLockRef.current = false;
            setScanState('idle');
          }, 2000);
          return;
        }

        if (releases.length === 1) {
          // Single result: fetch detail and auto-select
          const hit = releases[0]!;
          const detail = await fetchReleaseDetail(hit.id, token);
          if (!detail) {
            setScanState('error');
            setSnackbar('Release details unavailable');
            setTimeout(() => {
              scanLockRef.current = false;
              setScanState('idle');
            }, 2000);
            return;
          }
          detail.barcode = data;
          patchSearchResultImages(hit, detail);
          setResult(hit);
          setReleaseDetail(detail);
          setScanState('result');
        } else {
          // Multiple results: show picker (no detail fetching needed)
          setCandidates(releases);
          setCoverMap(new Map());
          setScanState('disambiguate');
          // Fetch one cover per unique title in background
          const titleToFirst = new Map<string, number>();
          for (const r of releases) {
            if (!titleToFirst.has(r.title)) titleToFirst.set(r.title, r.id);
          }
          for (const [releaseTitle, releaseId] of titleToFirst) {
            fetchReleaseImages(releaseId, token)
              .then(({ coverImage }) => {
                if (!coverImage) return;
                const ids = releases.filter((r) => r.title === releaseTitle).map((r) => r.id);
                setCoverMap((prev) => {
                  const next = new Map(prev);
                  for (const id of ids) next.set(id, coverImage);
                  return next;
                });
              })
              .catch(() => {});
          }
        }
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
    const { artist, title } = releaseDetail
      ? { artist: releaseDetail.artistDisplay, title: releaseDetail.title }
      : parseArtistTitle(result.title);
    const album: Album = {
      id: Crypto.randomUUID(),
      discogsId: releaseDetail?.id ?? result.id,
      barcode: scannedBarcodeRef.current,
      title,
      artist,
      year: releaseDetail?.year ?? (result.year ? parseInt(result.year, 10) : null),
      thumb: result.thumb,
      coverImage: result.cover_image,
      genre: result.genre || [],
      format: result.format || [],
      catalogNumber: releaseDetail?.labels[0]?.catno ?? result.catno ?? '',
      country: releaseDetail?.country,
      addedAt: Date.now(),
      redStatus: redStatus ?? undefined,
    };
    addAlbum(album);
    setLastAdded(album);
    setResult(null);
    setReleaseDetail(null);
    setScanState('idle');
    scanLockRef.current = false;
    setSnackbar(`Added "${title}" to collection`);
  }, [result, releaseDetail, redStatus, addAlbum]);

  const handleDismiss = useCallback(() => {
    setResult(null);
    setReleaseDetail(null);
    setCandidates([]);
    setScanState('idle');
    scanLockRef.current = false;
  }, []);

  const selectingRef = useRef(false);

  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<{ id: number; message: string } | null>(null);

  const handleSelectRelease = useCallback(async (selected: DiscogsSearchResult) => {
    selectingRef.current = true;
    setPickerLoading(true);
    try {
      const token = settings.discogsToken || undefined;
      const detail = await fetchReleaseDetail(selected.id, token);
      if (!detail) {
        setPickerError({ id: selected.id, message: 'Release details are unavailable on Discogs for this pressing.' });
        return;
      }
      detail.barcode = scannedBarcodeRef.current;
      patchSearchResultImages(selected, detail);
      setResult(selected);
      setReleaseDetail(detail);
      setCandidates([]);
      setScanState('result');
    } catch {
      setPickerError({ id: selected.id, message: 'Failed to fetch release details. This may be a network issue.' });
    } finally {
      selectingRef.current = false;
      setPickerLoading(false);
    }
  }, [settings.discogsToken]);

  const handlePickerErrorDismiss = useCallback(() => {
    if (pickerError) {
      setCandidates((prev) => prev.filter((c) => c.id !== pickerError.id));
    }
    setPickerError(null);
  }, [pickerError]);

  const handlePickerDismiss = useCallback(() => {
    if (selectingRef.current) return;
    setCandidates([]);
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
          {settings.redApiKey ? (
            <View style={styles.redStatusRow}>
              {redLoading ? (
                <Chip icon="loading" compact>Checking RED...</Chip>
              ) : redStatus ? (
                <>
                  <Chip
                    icon={redStatus.uploaded ? 'check-circle' : 'progress-upload'}
                    compact
                    style={redStatus.uploaded ? undefined : styles.chipNotUploaded}
                  >
                    {redStatus.uploaded ? 'Already on RED' : 'Not uploaded yet!'}
                  </Chip>
                  {redStatus.requests[0] && (
                    <Chip icon={({ size, color }) => <FontAwesome6 name="sack-dollar" size={size - 4} color={color} />} compact>
                      Request exists: {redStatus.requests[0].formatList}
                    </Chip>
                  )}
                  {(redStatus.otherEditionCount ?? 0) > 0 && (
                    <Chip icon="disc" compact>
                      {redStatus.otherEditionCount} other edition{redStatus.otherEditionCount !== 1 ? 's' : ''}
                    </Chip>
                  )}
                </>
              ) : null}
            </View>
          ) : null}
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

      <ReleasePicker
        visible={scanState === 'disambiguate'}
        candidates={candidates}
        coverMap={coverMap}
        loading={pickerLoading}
        onSelect={handleSelectRelease}
        onDismiss={handlePickerDismiss}
      />

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
  redStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chipNotUploaded: {
    backgroundColor: '#c8e6c9',
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
