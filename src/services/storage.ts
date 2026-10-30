import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Album, Settings } from '../types';

const COLLECTION_KEY = 'scout_collection';
const SETTINGS_KEY = 'scout_settings';
const EXPORT_VERSION = 1;

export async function loadCollection(): Promise<Album[]> {
  const json = await AsyncStorage.getItem(COLLECTION_KEY);
  if (!json) return [];
  return migrateAlbums(JSON.parse(json) as Album[]);
}

function migrateAlbums(albums: Album[]): Album[] {
  // Migrate old RedStatus objects that lack the 'result' field
  for (const album of albums) {
    if (album.redStatus && !album.redStatus.result) {
      album.redStatus.result = album.redStatus.uploaded ? 'uploaded' : 'not_uploaded';
    }
  }
  return albums;
}

export async function saveCollection(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(albums));
}

export async function loadSettings(): Promise<Settings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!json) return { discogsToken: '', themeMode: 'system', redApiKey: '', frogModeActive: false, frogModeFound: false};
  return JSON.parse(json) as Settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function exportCollection(albums: Album[]): string {
  return JSON.stringify({ app: 'scout', version: EXPORT_VERSION, exportedAt: Date.now(), albums }, null, 2);
}

export function parseCollectionExport(json: string): Album[] {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('This file is not a Scout export');
  }
  if (data?.app !== 'scout' || !Array.isArray(data.albums)) {
    throw new Error('This file is not a Scout export');
  }
  if (data.version > EXPORT_VERSION) {
    throw new Error('This export is from a newer version of Scout');
  }
  return migrateAlbums(data.albums.filter(isAlbum));
}

function isAlbum(a: any): a is Album {
  return typeof a?.id === 'string'
    && typeof a.discogsId === 'number'
    && typeof a.title === 'string'
    && typeof a.artist === 'string'
    && typeof a.barcode === 'string'
    && Array.isArray(a.format)
    && Array.isArray(a.genre);
}
