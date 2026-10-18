import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Album, Settings } from '../types';

const COLLECTION_KEY = 'scout_collection';
const SETTINGS_KEY = 'scout_settings';

// API keys are kept in secure storage, not in the settings JSON
type SecretField = 'discogsToken' | 'redApiKey';
const SECRET_KEYS: Record<SecretField, string> = {
  discogsToken: 'scout_discogs_token',
  redApiKey: 'scout_red_api_key',
};
const SECRET_FIELDS = Object.keys(SECRET_KEYS) as SecretField[];

const DEFAULT_SETTINGS: Settings = {
  discogsToken: '',
  themeMode: 'system',
  redApiKey: '',
  frogModeActive: false,
  frogModeFound: false,
};

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

async function readSecret(field: SecretField): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(SECRET_KEYS[field])) ?? '';
  } catch (e) {
    console.warn(`Could not read ${field} from secure storage`, e);
    return '';
  }
}

async function writeSecret(field: SecretField, value: string): Promise<boolean> {
  try {
    if (value) await SecureStore.setItemAsync(SECRET_KEYS[field], value);
    else await SecureStore.deleteItemAsync(SECRET_KEYS[field]);
    return true;
  } catch (e) {
    console.warn(`Could not save ${field} to secure storage`, e);
    return false;
  }
}

function withoutSecrets(settings: Partial<Settings>, fields = SECRET_FIELDS): Partial<Settings> {
  const rest = { ...settings };
  for (const field of fields) delete rest[field];
  return rest;
}

export async function loadSettings(): Promise<Settings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  const stored: Partial<Settings> = json ? JSON.parse(json) : {};
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // Older versions kept the keys here, drop them only once secure storage has them
  const legacy = SECRET_FIELDS.filter((field) => field in stored);
  const moved = await Promise.all(legacy.map((field) => writeSecret(field, settings[field])));
  if (legacy.length > 0 && moved.every(Boolean)) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(withoutSecrets(stored)));
  }
  for (const field of SECRET_FIELDS) {
    if (!legacy.includes(field)) settings[field] = await readSecret(field);
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const saved = await Promise.all(SECRET_FIELDS.map((field) => writeSecret(field, settings[field])));
  // A key that secure storage refused stays in the JSON, so it isn't lost and moves on the next load
  const moved = SECRET_FIELDS.filter((_, i) => saved[i]);
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(withoutSecrets(settings, moved)));
}
