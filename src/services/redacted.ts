import type { RedStatus, RedRequest } from '../types';

const BASE_URL = 'https://redacted.sh/ajax.php';
const RATE_LIMIT = 10;
const RATE_WINDOW = 10_000; // 10 seconds

const requestTimestamps: number[] = [];

async function rateLimitedFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const now = Date.now();
  // Remove timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0]! <= now - RATE_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT) {
    const waitUntil = requestTimestamps[0]! + RATE_WINDOW;
    await new Promise((resolve) => setTimeout(resolve, waitUntil - now));
  }
  requestTimestamps.push(Date.now());
  return fetch(url, init);
}

function headers(apiKey: string): HeadersInit {
  return { Authorization: apiKey };
}

interface BrowseResponse {
  status: string;
  response: {
    currentPage: number;
    pages: number;
    results: {
      groupId: number;
      groupName: string;
      artist: string;
      groupYear: number;
      torrents: {
        torrentId: number;
        format: string;
        encoding: string;
        media: string;
        seeders: number;
        snatched: number;
        remasterTitle: string;
        remasterCatalogueNumber: string;
        remastered: boolean;
      }[];
    }[];
  };
}

interface RequestsResponse {
  status: string;
  response: {
    currentPage: number;
    pages: number;
    results: {
      requestId: number;
      title: string;
      year: number;
      bounty: number;
      formatList: string;
      isFilled: boolean;
    }[];
  };
}

async function browseTorrents(
  params: Record<string, string>,
  apiKey: string,
): Promise<BrowseResponse['response']['results']> {
  const query = new URLSearchParams({ action: 'browse', ...params });
  const res = await rateLimitedFetch(`${BASE_URL}?${query}`, { headers: headers(apiKey) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited');
    throw new Error(`RED API error: ${res.status}`);
  }
  const data: BrowseResponse = await res.json();
  // Gazelle returns "failure" for no results - treat as empty, not an error
  if (data.status !== 'success') return [];
  return data.response.results;
}

async function searchTorrents(
  artist: string,
  title: string,
  catalogueNumber: string,
  apiKey: string,
  barcode: string = '',
): Promise<BrowseResponse['response']['results']> {
  // Try catalogue number first - most precise match for an edition
  if (catalogueNumber) {
    const results = await browseTorrents({ remastercataloguenumber: catalogueNumber }, apiKey);
    if (results.length > 0) return results;
    // Also try group-level catalogue number field
    const groupResults = await browseTorrents({ cataloguenumber: catalogueNumber }, apiKey);
    if (groupResults.length > 0) return groupResults;
  }

  // Try barcode as catalogue number - uploaders often put barcodes in this field
  if (barcode && barcode !== catalogueNumber) {
    const results = await browseTorrents({ remastercataloguenumber: barcode }, apiKey);
    if (results.length > 0) return results;
  }

  // Fall back to artist + title as separate fields for better matching
  const results = await browseTorrents({ artistname: artist, groupname: title }, apiKey);
  return results;
}

async function searchRequests(
  artist: string,
  title: string,
  apiKey: string,
): Promise<RequestsResponse['response']['results']> {
  const params = new URLSearchParams({
    action: 'requests',
    search: `${artist} ${title}`,
    show_filled: 'false',
  });

  const res = await rateLimitedFetch(`${BASE_URL}?${params}`, { headers: headers(apiKey) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited');
    throw new Error(`RED API error: ${res.status}`);
  }
  const data: RequestsResponse = await res.json();
  // Gazelle returns "failure" for no results - treat as empty, not an error
  if (data.status !== 'success') return [];
  return data.response.results;
}

// Strip leading zeros, remove separators, and lowercase for comparison
function normalizeCatNo(s: string): string {
  return s.replace(/[\s\-_.\/]/g, '').replace(/^0+/, '').toLowerCase();
}

function catalogueMatches(redCatNo: string, discogsCatNo: string, barcode: string): boolean {
  if (!redCatNo) return false;
  const normalizedRed = normalizeCatNo(redCatNo);
  if (!normalizedRed) return false;

  // Check both directions - RED may contain extra info (barcode appended),
  // or Discogs may contain extra info (format suffix like "CD")
  if (discogsCatNo) {
    const normalizedDiscogs = normalizeCatNo(discogsCatNo);
    if (normalizedRed.includes(normalizedDiscogs) || normalizedDiscogs.includes(normalizedRed)) return true;
  }
  if (barcode) {
    const normalizedBarcode = normalizeCatNo(barcode);
    if (normalizedRed.includes(normalizedBarcode) || normalizedBarcode.includes(normalizedRed)) return true;
  }
  return false;
}

// Map Discogs format name to RED media type
export function discogsFormatToRedMedia(formats: string[]): string | null {
  const media = formats[0];
  if (!media) return null;
  const map: Record<string, string> = {
    'CD': 'CD',
    'CDr': 'CD',
    'Vinyl': 'Vinyl',
    'Cassette': 'Cassette',
    'Blu-ray': 'Blu-Ray',
    'DVD': 'DVD',
    'SACD': 'SACD',
  };
  return map[media] ?? null;
}

export async function getRedStatus(
  artist: string,
  title: string,
  catalogueNumber: string,
  apiKey: string,
  media: string | null = null,
  barcode: string = '',
): Promise<RedStatus> {
  const [torrentResults, requestResults] = await Promise.all([
    searchTorrents(artist, title, catalogueNumber, apiKey, barcode).catch(() => [] as BrowseResponse['response']['results']),
    searchRequests(artist, title, apiKey).catch(() => [] as RequestsResponse['response']['results']),
  ]);

  let uploaded = false;
  const otherCatalogueNumbers = new Set<string>();

  for (const group of torrentResults) {
    for (const t of group.torrents) {
      if (media && t.media !== media) continue;

      const hasCatNoOrBarcode = catalogueNumber || barcode;
      if (!hasCatNoOrBarcode || catalogueMatches(t.remasterCatalogueNumber, catalogueNumber, barcode)) {
        uploaded = true;
      } else {
        otherCatalogueNumbers.add(t.remasterCatalogueNumber || 'original');
      }
    }
  }

  const requests: RedRequest[] = requestResults
    .filter((r) => !r.isFilled)
    .map((r) => ({
      requestId: r.requestId,
      title: r.title,
      year: r.year,
      bounty: r.bounty,
      formatList: r.formatList,
    }));

  return {
    uploaded,
    otherEditionCount: otherCatalogueNumbers.size,
    requestCount: requests.length,
    requests,
    checkedAt: Date.now(),
  };
}
