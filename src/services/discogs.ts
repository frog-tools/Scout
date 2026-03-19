import type { DiscogsSearchResponse, DiscogsSearchResult } from '../types';
import { version as appVersion } from '../../package.json';

const BASE_URL = 'https://api.discogs.com';
const USER_AGENT = `Scout/${appVersion}`;

function headers(token?: string): HeadersInit {
  const h: HeadersInit = { 'User-Agent': USER_AGENT };
  if (token) h['Authorization'] = `Discogs token=${token}`;
  return h;
}

export async function searchByBarcode(
  barcode: string,
  token?: string,
): Promise<DiscogsSearchResult[]> {
  const url = `${BASE_URL}/database/search?barcode=${encodeURIComponent(barcode)}&type=release`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`Discogs API error: ${res.status}`);
  const data: DiscogsSearchResponse = await res.json();
  return data.results;
}

export async function fetchReleaseImages(
  releaseId: number,
  token?: string,
): Promise<{ thumb: string; coverImage: string }> {
  const url = `${BASE_URL}/releases/${releaseId}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return { thumb: '', coverImage: '' };
  const data = await res.json();
  const primary = data.images?.find((img: { type: string }) => img.type === 'primary') ?? data.images?.[0];
  return {
    thumb: primary?.uri150 ?? data.thumb ?? '',
    coverImage: primary?.uri ?? '',
  };
}

export function parseArtistTitle(discogsTitle: string): { artist: string; title: string } {
  const idx = discogsTitle.indexOf(' - ');
  if (idx === -1) return { artist: 'Unknown', title: discogsTitle };
  return {
    artist: discogsTitle.slice(0, idx).trim(),
    title: discogsTitle.slice(idx + 3).trim(),
  };
}
