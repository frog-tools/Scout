import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Album, Settings } from '../types';

const COLLECTION_KEY = 'scout_collection';
const SETTINGS_KEY = 'scout_settings';

export async function loadCollection(): Promise<Album[]> {
  const json = await AsyncStorage.getItem(COLLECTION_KEY);
  if (!json) return [];
  return JSON.parse(json) as Album[];
}

export async function saveCollection(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(albums));
}

export async function loadSettings(): Promise<Settings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!json) return { discogsToken: '', themeMode: 'system', redApiKey: '', frogMode: false };
  return JSON.parse(json) as Settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
