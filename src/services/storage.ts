import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Album, Settings } from '../types';

const COLLECTION_KEY = 'scout_collection';
const SETTINGS_KEY = 'scout_settings';

export async function loadCollection(): Promise<Album[]> {
  const json = await AsyncStorage.getItem(COLLECTION_KEY);
  if (!json) return [];
  const albums = JSON.parse(json) as Album[];
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
