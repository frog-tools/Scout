import type {
  DiscogsSearchResponse,
  DiscogsSearchResult,
  DiscogsReleaseDetail,
  DiscogsArtistCredit,
  DiscogsTrack,
} from '../types';
import { version as appVersion } from '../../package.json';

const BASE_URL = 'https://api.discogs.com';
const USER_AGENT = `Scout/${appVersion}`;

function headers(token?: string): HeadersInit {
  const h: HeadersInit = { 'User-Agent': USER_AGENT };
  if (token) h['Authorization'] = `Discogs token=${token}`;
  return h;
}

// ── Existing functions ─────────────────────────────────────────────

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
  const primary =
    data.images?.find((img: { type: string }) => img.type === 'primary') ??
    data.images?.[0];
  return {
    thumb: primary?.uri150 ?? data.thumb ?? '',
    coverImage: primary?.uri ?? '',
  };
}

export function parseArtistTitle(discogsTitle: string): {
  artist: string;
  title: string;
} {
  const idx = discogsTitle.indexOf(' - ');
  if (idx === -1) return { artist: 'Unknown', title: discogsTitle };
  return {
    artist: stripDiscogsDisambiguator(discogsTitle.slice(0, idx).trim()),
    title: discogsTitle.slice(idx + 3).trim(),
  };
}

/** Strip Discogs disambiguation suffix like " (2)" from artist names. */
export function stripDiscogsDisambiguator(name: string): string {
  return name.replace(/\s*\(\d+\)$/, '');
}

// ── New functions ──────────────────────────────────────────────────

/**
 * Fetch full release details from Discogs.
 * Returns null if the release 404s (used as step 2 validation).
 */
export async function fetchReleaseDetail(
  releaseId: number,
  token?: string,
): Promise<DiscogsReleaseDetail | null> {
  const url = `${BASE_URL}/releases/${releaseId}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return null;

  const data = await res.json();
  const artistDisplay = resolveArtistName(data.artists ?? []);

  return {
    id: data.id,
    title: data.title ?? '',
    year: data.year ?? null,
    country: data.country ?? '',
    formats: data.formats ?? [],
    labels: data.labels ?? [],
    identifiers: data.identifiers ?? [],
    tracklist: data.tracklist ?? [],
    artists: data.artists ?? [],
    images: data.images,
    artistDisplay,
    barcode: '', // set by caller
  };
}

/**
 * Step 2: Filter search results — remove non-release types and 404s.
 * Returns a cache map of release ID → detail for valid results.
 */
export async function filterValidReleases(
  results: DiscogsSearchResult[],
  token?: string,
): Promise<{
  valid: DiscogsSearchResult[];
  detailCache: Map<number, DiscogsReleaseDetail>;
}> {
  // Remove non-release types
  const releases = results.filter((r) => r.type === 'release');

  const valid: DiscogsSearchResult[] = [];
  const detailCache = new Map<number, DiscogsReleaseDetail>();

  for (const r of releases) {
    const detail = await fetchReleaseDetail(r.id, token);
    if (detail) {
      valid.push(r);
      detailCache.set(r.id, detail);
    }
  }

  return { valid, detailCache };
}

/**
 * Resolve artist display name from Discogs artist credits.
 * Handles ANVs, "(2)" disambiguation suffixes, and multi-artist joins.
 */
export function resolveArtistName(artists: DiscogsArtistCredit[]): string {
  if (artists.length === 0) return 'Unknown';

  const parts: string[] = [];
  for (let i = 0; i < artists.length; i++) {
    const a = artists[i]!;
    // Use ANV if present, otherwise strip "(N)" disambiguation suffix
    const name = a.anv || stripDiscogsDisambiguator(a.name);
    parts.push(name);
    if (i < artists.length - 1 && a.join) {
      parts.push(a.join);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parse Discogs duration string "M:SS" or "MM:SS" to seconds.
 * Returns null for empty or unparseable durations.
 */
export function parseDuration(duration: string): number | null {
  if (!duration) return null;
  const parts = duration.split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0]!, 10);
  const secs = parseInt(parts[1]!, 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs;
}

/**
 * Filter a tracklist to audio tracks only.
 * Removes headings ("CD 1", "Side A"), index entries, and data tracks.
 */
export function filterAudioTracks(tracklist: DiscogsTrack[]): DiscogsTrack[] {
  return tracklist.filter((t) => t.type_ === 'track');
}
