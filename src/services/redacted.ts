import type {
  DiscogsReleaseDetail,
  DiscogsFormat,
  RedStatus,
  RedRequest,
  RedArtistTorrentGroup,
  RedGroupDetail,
  RedGroupTorrent,
  RedMatchResult,
} from '../types';
import { parseDuration, filterAudioTracks } from './discogs';

// -- Constants ------------------------------------------------------

const BASE_URL = 'https://redacted.sh/ajax.php';
const RATE_LIMIT = 10;
const RATE_WINDOW = 10_000;

// -- Rate limiter (sliding window) ----------------------------------

const requestTimestamps: number[] = [];

async function rateLimitedFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const now = Date.now();
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

// -- API layer ------------------------------------------------------

interface ArtistResponse {
  status: string;
  response: {
    id: number;
    name: string;
    torrentgroup: RedArtistTorrentGroup[];
    requests: { requestId: number; title: string; year: number; bounty: number }[];
  };
}

interface TorrentGroupResponse {
  status: string;
  response: RedGroupDetail;
}

interface BrowseResponse {
  status: string;
  response: {
    results: {
      groupId: number;
      groupName: string;
      artist: string;
      groupYear: number;
      releaseType: string;
      torrents: {
        torrentId: number;
        format: string;
        encoding: string;
        media: string;
        remasterTitle: string;
        remasterCatalogueNumber: string;
        remasterRecordLabel: string;
        remasterYear: number;
        remastered: boolean;
        fileCount: number;
      }[];
    }[];
  };
}

interface RequestsResponse {
  status: string;
  response: {
    results: {
      requestId: number;
      title: string;
      year: number;
      bounty: number;
      formatList: string;
      isFilled: boolean;
      groupId: number;
    }[];
  };
}

async function fetchArtist(
  name: string,
  apiKey: string,
): Promise<{ groups: RedArtistTorrentGroup[] }> {
  const query = new URLSearchParams({ action: 'artist', artistname: name });
  const res = await rateLimitedFetch(`${BASE_URL}?${query}`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`RED artist lookup failed: ${res.status}`);
  const data: ArtistResponse = await res.json();
  if (data.status !== 'success') return { groups: [] };
  return { groups: data.response.torrentgroup ?? [] };
}

async function fetchTorrentGroup(
  groupId: number,
  apiKey: string,
): Promise<RedGroupDetail | null> {
  const query = new URLSearchParams({ action: 'torrentgroup', id: String(groupId) });
  const res = await rateLimitedFetch(`${BASE_URL}?${query}`, { headers: headers(apiKey) });
  if (!res.ok) return null;
  const data: TorrentGroupResponse = await res.json();
  if (data.status !== 'success') return null;
  return data.response;
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
  if (data.status !== 'success') return [];
  return data.response.results;
}

async function searchRequests(
  searchTerm: string,
  apiKey: string,
): Promise<RequestsResponse['response']['results']> {
  const params = new URLSearchParams({
    action: 'requests',
    search: searchTerm,
    show_filled: 'false',
  });
  const res = await rateLimitedFetch(`${BASE_URL}?${params}`, { headers: headers(apiKey) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited');
    return [];
  }
  const data: RequestsResponse = await res.json();
  if (data.status !== 'success') return [];
  return data.response.results;
}

// -- Normalization utilities ----------------------------------------

/** Strip separators, leading zeros, and lowercase for catalogue number comparison. */
export function normalizeCatNo(s: string): string {
  return s.replace(/[\s\-_.\/]/g, '').replace(/^0+/, '').replace(/0+$/, '').toLowerCase();
}

/** Normalize a title for comparison: lowercase, strip non-alphanumeric, collapse spaces. */
export function normalizeTitle(s: string): string {
  return decodeHtmlEntities(s)
    .replace(/&\w+;/g, '')
    .replace(/&#x?[\da-fA-F]+;/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize a track name similarly to title, plus strip leading track numbering. */
export function normalizeTrackName(name: string): string {
  return normalizeTitle(name).replace(/^\d+\s*/, '');
}

/** Decode common HTML entities that appear in RED API responses. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Map a single Discogs format name to a RED media type string. */
export function discogsFormatToRedMedia(formatName: string): string | null {
  const map: Record<string, string> = {
    'CD': 'CD', 'CDr': 'CD',
    'Vinyl': 'Vinyl',
    'Cassette': 'Cassette',
    'Blu-ray': 'Blu-Ray',
    'DVD': 'DVD',
    'SACD': 'SACD',
  };
  return map[formatName] ?? null;
}

/** Map Discogs format descriptions to RED release type integer. */
export function discogsDescriptionsToRedReleaseType(descriptions: string[]): number | null {
  const map: Record<string, number> = {
    'Album': 1, 'Soundtrack': 3, 'EP': 5, 'Anthology': 6,
    'Compilation': 7, 'Single': 9, 'Live': 11, 'Remix': 13,
    'Mixtape': 16, 'Demo': 17, 'DJ Mix': 19,
  };
  for (const d of descriptions) {
    const rt = map[d];
    if (rt !== undefined) return rt;
  }
  return null;
}

/** Convert RED browse releaseType string to integer. */
function releaseTypeStringToInt(s: string): number {
  const map: Record<string, number> = {
    'Album': 1, 'Soundtrack': 3, 'EP': 5, 'Anthology': 6,
    'Compilation': 7, 'Single': 9, 'Live album': 11, 'Remix': 13,
    'Bootleg': 14, 'Interview': 15, 'Mixtape': 16, 'Demo': 17,
    'Concert Recording': 18, 'DJ Mix': 19, 'Unknown': 21,
  };
  return map[s] ?? 21;
}

export function isVariousArtists(artist: string): boolean {
  const lower = artist.toLowerCase().trim();
  return lower === 'various' || lower === 'various artists' || lower === 'va';
}

// -- Candidate type for matching pipeline ---------------------------

interface TorrentCandidate {
  torrentId: number;
  groupId: number;
  groupName: string;
  groupYear: number;
  media: string;
  format: string;
  encoding: string;
  remasterYear: number;
  remasterTitle: string;
  remasterRecordLabel: string;
  remasterCatalogueNumber: string;
  fileCount: number;
  fileList: string;
  description: string;
}

// -- Step 6: Filter by release type ---------------------------------

function filterByReleaseType(
  groups: RedArtistTorrentGroup[],
  discogsFormats: DiscogsFormat[],
): RedArtistTorrentGroup[] {
  // Collect all descriptions across all Discogs formats
  const allDescs = discogsFormats.flatMap((f) => f.descriptions ?? []);
  const releaseType = discogsDescriptionsToRedReleaseType(allDescs);

  // Filter out artist-role entries (1021+)
  const musicGroups = groups.filter((g) => g.releaseType < 1000);

  if (releaseType === null) return musicGroups;

  // Anthology (6) and Compilation (7) are often used interchangeably
  const equivalent = releaseType === 6 || releaseType === 7 ? [6, 7] : [releaseType];

  const matched = musicGroups.filter(
    (g) => equivalent.includes(g.releaseType) || g.releaseType === 21,
  );
  // If no matches with type filter, fall back to all music groups
  return matched.length > 0 ? matched : musicGroups;
}

// -- Step 7: Title matching -----------------------------------------

function matchByTitle(
  groups: RedArtistTorrentGroup[],
  discogsTitle: string,
): RedArtistTorrentGroup[] {
  const target = normalizeTitle(discogsTitle);

  // Pass 1: exact normalized match
  const exact = groups.filter((g) => normalizeTitle(g.groupName) === target);
  if (exact.length > 0) return exact;

  // Pass 2: one contains the other (for subtitles, suffixes, etc.)
  const contains = groups.filter((g) => {
    const norm = normalizeTitle(g.groupName);
    return norm.includes(target) || target.includes(norm);
  });
  return contains;
}

// -- Steps 8–9: Successive narrowing --------------------------------

function filterByMedia(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): TorrentCandidate[] {
  const formatName = release.formats[0]?.name;
  if (!formatName) return candidates;
  const redMedia = discogsFormatToRedMedia(formatName);
  if (!redMedia) return candidates;
  return candidates.filter((c) => c.media === redMedia);
}

function filterByCatalogueNumber(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): TorrentCandidate[] {
  const discogsCatNos = release.labels.map((l) => l.catno).filter(Boolean);
  if (discogsCatNos.length === 0) return candidates;

  // Pass 1: exact normalized match
  const exact = candidates.filter((c) => {
    if (!c.remasterCatalogueNumber) return false;
    const normRed = normalizeCatNo(c.remasterCatalogueNumber);
    return discogsCatNos.some((catno) => normalizeCatNo(catno) === normRed);
  });
  if (exact.length > 0) return exact;

  // Pass 2: loose substring match (bidirectional)
  const loose = candidates.filter((c) => {
    if (!c.remasterCatalogueNumber) return false;
    const normRed = normalizeCatNo(c.remasterCatalogueNumber);
    if (!normRed) return false;
    return discogsCatNos.some((catno) => {
      const normDisc = normalizeCatNo(catno);
      return normRed.includes(normDisc) || normDisc.includes(normRed);
    }) || (release.barcode && (
      normRed.includes(normalizeCatNo(release.barcode)) ||
      normalizeCatNo(release.barcode).includes(normRed)
    ));
  });
  if (loose.length > 0) return loose;

  // Pass 3: also match candidates with empty catno (original releases)
  // If no candidates matched, include the originals that may not have catalogue numbers set
  const originals = candidates.filter((c) => !c.remasterCatalogueNumber);
  return originals.length > 0 ? originals : candidates;
}

function filterByLabel(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): TorrentCandidate[] {
  const discogsLabels = release.labels.map((l) => l.name.toLowerCase()).filter(Boolean);
  if (discogsLabels.length === 0) return candidates;

  const matched = candidates.filter((c) => {
    const redLabel = (c.remasterRecordLabel || '').toLowerCase();
    if (!redLabel) return false;
    return discogsLabels.some((dl) => redLabel.includes(dl) || dl.includes(redLabel));
  });
  return matched.length > 0 ? matched : candidates;
}

function filterByEditionTitle(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): TorrentCandidate[] {
  const descriptions = release.formats.flatMap((f) => f.descriptions ?? []);
  // Only use descriptors that are meaningful for edition matching
  const meaningful = descriptions.filter(
    (d) => !['Album', 'Single', 'EP', 'Compilation', 'LP', 'Stereo', 'Mono'].includes(d),
  );
  if (meaningful.length === 0) return candidates;

  const matched = candidates.filter((c) => {
    const title = c.remasterTitle.toLowerCase();
    return meaningful.some((d) => title.includes(d.toLowerCase()));
  });
  return matched.length > 0 ? matched : candidates;
}

function filterByYear(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): TorrentCandidate[] {
  if (!release.year) return candidates;

  const matched = candidates.filter((c) => {
    const year = c.remasterYear || c.groupYear;
    return year === release.year;
  });
  return matched.length > 0 ? matched : candidates;
}

type NarrowResult =
  | { result: 'single'; candidate: TorrentCandidate }
  | { result: 'zero' }
  | { result: 'multiple'; candidates: TorrentCandidate[] };

function editionKeyOf(c: TorrentCandidate): string {
  return `${c.groupId}|${c.media}|${c.remasterYear}|${c.remasterTitle}|${c.remasterRecordLabel}|${c.remasterCatalogueNumber}`;
}

function narrowCandidates(
  candidates: TorrentCandidate[],
  release: DiscogsReleaseDetail,
): NarrowResult {
  const steps: ((cs: TorrentCandidate[]) => TorrentCandidate[])[] = [
    (cs) => filterByMedia(cs, release),
    (cs) => filterByCatalogueNumber(cs, release),
    (cs) => filterByLabel(cs, release),
    (cs) => filterByEditionTitle(cs, release),
    (cs) => filterByYear(cs, release),
  ];

  let current = candidates;
  for (const step of steps) {
    const next = step(current);
    if (next.length === 0) return { result: 'zero' };
    current = next;
    // Check if all remaining candidates belong to the same edition
    const editions = new Set(current.map(editionKeyOf));
    if (editions.size === 1) return { result: 'single', candidate: current[0]! };
  }

  return { result: 'multiple', candidates: current };
}

// -- Steps 10–11: Track matching ------------------------------------

/** Parse RED torrent fileList into audio file names. */
function parseRedFileList(fileList: string): string[] {
  if (!fileList) return [];
  const audioExts = /\.(flac|mp3|ogg|opus|m4a|aac|wav|ape|wv|alac)$/i;
  return fileList
    .split('|||')
    .map((entry) => entry.replace(/\{\{\{\d+\}\}\}/, '').trim())
    .filter((name) => audioExts.test(name))
    .map((name) => {
      // Strip directory prefix and extension, then strip leading track numbers
      const base = name.replace(/.*\//, '').replace(/\.[^.]+$/, '');
      return base
        .replace(/^\d+[\s._-]+/, '') // "01 - Track" -> "Track"
        .replace(/^\d+\s*/, '')      // "01Track" -> "Track"
        .trim();
    });
}

/** Parse track listings from RED group description (BBCode/HTML). */
function parseRedDescriptionTracks(
  description: string,
): { name: string; durationSeconds: number | null }[] {
  if (!description) return [];

  const decoded = decodeHtmlEntities(description);
  // Strip BBCode/HTML tags
  const stripped = decoded
    .replace(/\[\/?\w+\]/g, '')
    .replace(/<[^>]+>/g, '');

  const tracks: { name: string; durationSeconds: number | null }[] = [];

  // Match patterns like: "1. Track Name (3:45)" or "01 - Track Name [3:45]"
  const linePattern = /^\s*(?:\d+[\s.)\-]+)(.+?)(?:\s*[\[(](\d+:\d+)[\])]\s*)?$/;
  for (const line of stripped.split('\n')) {
    const m = line.match(linePattern);
    if (m) {
      const name = m[1]!.trim();
      if (name.length > 0) {
        tracks.push({
          name,
          durationSeconds: m[2] ? parseDuration(m[2]) : null,
        });
      }
    }
  }

  return tracks;
}

/**
 * Check if two track listings match, ignoring order.
 * Uses bijective name matching and uniform-offset duration checking.
 */
function trackListingsMatch(
  discogsTracks: { name: string; durationSeconds: number | null }[],
  redTracks: { name: string }[],
  _mediaType: string,
): boolean {
  if (discogsTracks.length === 0 || redTracks.length === 0) return false;
  // RED should have at least as many tracks
  if (redTracks.length < discogsTracks.length) return false;

  // Try to match each Discogs track to a RED track by name
  const usedRedIndices = new Set<number>();
  const normRedNames = redTracks.map((t) => normalizeTrackName(t.name));
  let matchedCount = 0;

  for (const dTrack of discogsTracks) {
    const normDiscogs = normalizeTrackName(dTrack.name);
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < normRedNames.length; i++) {
      if (usedRedIndices.has(i)) continue;
      const normRed = normRedNames[i]!;

      // Exact match
      if (normRed === normDiscogs) {
        bestIdx = i;
        bestScore = 3;
        break;
      }
      // One contains the other
      if ((normRed.includes(normDiscogs) || normDiscogs.includes(normRed)) && bestScore < 2) {
        bestIdx = i;
        bestScore = 2;
      }
    }

    if (bestIdx >= 0) {
      usedRedIndices.add(bestIdx);
      matchedCount++;
    }
  }

  // Require at least 80% of Discogs tracks to match
  return matchedCount >= discogsTracks.length * 0.8;
}

/**
 * Step 10: Try to match against track listings from RED torrent groups.
 * Checks file lists and group descriptions for track data.
 */
function matchByTrackListing(
  release: DiscogsReleaseDetail,
  groupDetails: RedGroupDetail[],
): TorrentCandidate[] {
  const audioTracks = filterAudioTracks(release.tracklist);
  if (audioTracks.length === 0) return [];

  const discogsTracks = audioTracks.map((t) => ({
    name: t.title,
    durationSeconds: parseDuration(t.duration),
  }));

  const formatName = release.formats[0]?.name ?? 'CD';
  const media = discogsFormatToRedMedia(formatName) ?? 'CD';
  const matched: TorrentCandidate[] = [];

  for (const group of groupDetails) {
    // Try matching against group description track listing
    const descTracks = parseRedDescriptionTracks(group.group.bbBody || group.group.wikiBody || '');

    for (const torrent of group.torrents) {
      // Filter by media first
      if (torrent.media !== media) continue;

      // Try file list track names
      const fileTrackNames = parseRedFileList(torrent.fileList);
      if (fileTrackNames.length > 0) {
        const redTracks = fileTrackNames.map((name) => ({ name }));
        if (trackListingsMatch(discogsTracks, redTracks, media)) {
          matched.push(torrentToCandidate(torrent, group));
          continue;
        }
      }

      // Try description tracks (shared across all torrents in group)
      if (descTracks.length > 0) {
        if (trackListingsMatch(discogsTracks, descTracks, media)) {
          matched.push(torrentToCandidate(torrent, group));
          continue;
        }
      }

      // If track count matches and we have no better data, count as match
      if (fileTrackNames.length === 0 && descTracks.length === 0 && torrent.fileCount >= audioTracks.length) {
        matched.push(torrentToCandidate(torrent, group));
      }
    }
  }

  return matched;
}

function torrentToCandidate(torrent: RedGroupTorrent, group: RedGroupDetail): TorrentCandidate {
  return {
    torrentId: torrent.id,
    groupId: group.group.id,
    groupName: group.group.name,
    groupYear: group.group.year,
    media: torrent.media,
    format: torrent.format,
    encoding: torrent.encoding,
    remasterYear: torrent.remasterYear,
    remasterTitle: torrent.remasterTitle,
    remasterRecordLabel: torrent.remasterRecordLabel,
    remasterCatalogueNumber: torrent.remasterCatalogueNumber,
    fileCount: torrent.fileCount,
    fileList: torrent.fileList,
    description: torrent.description,
  };
}

// -- Edition counting -----------------------------------------------

function countOtherEditions(
  matched: TorrentCandidate,
  allCandidates: TorrentCandidate[],
): number {
  const matchedKey = editionKeyOf(matched);
  const otherKeys = new Set<string>();

  for (const c of allCandidates) {
    const key = editionKeyOf(c);
    if (key !== matchedKey) otherKeys.add(key);
  }

  return otherKeys.size;
}

// -- Request matching -----------------------------------------------

function matchRequests(
  results: RequestsResponse['response']['results'],
  groupId?: number,
): RedRequest[] {
  return results
    .filter((r) => !r.isFilled)
    .filter((r) => groupId === undefined || r.groupId === groupId)
    .map((r) => ({
      requestId: r.requestId,
      title: r.title,
      year: r.year,
      bounty: r.bounty,
      formatList: r.formatList,
    }));
}

/** Search requests and filter to those linked to a specific group. */
async function fetchRequestsForGroup(
  groupName: string,
  groupId: number,
  apiKey: string,
): Promise<RedRequest[]> {
  const results = await searchRequests(groupName, apiKey).catch(() => []);
  return matchRequests(results, groupId);
}

// -- Main orchestrator (steps 5–11) ---------------------------------

function isEditionTrumpable(matched: TorrentCandidate, allCandidates: TorrentCandidate[]): boolean {
  const key = editionKeyOf(matched);
  return !allCandidates.some(
    (c) => editionKeyOf(c) === key && c.encoding === 'Lossless',
  );
}

function makeResult(
  result: RedMatchResult,
  otherEditionCount: number,
  requests: RedRequest[],
  trumpable = false,
  matchedGroupId?: number,
): RedStatus {
  return {
    result,
    uploaded: result === 'uploaded',
    trumpable,
    otherEditionCount,
    requestCount: requests.length,
    requests,
    checkedAt: Date.now(),
    matchedGroupId,
  };
}

export async function getRedStatus(
  release: DiscogsReleaseDetail,
  apiKey: string,
): Promise<RedStatus> {
  const artist = release.artistDisplay;
  const title = release.title;

  // Step 5: Look up artist (or browse for VA releases)
  let groups: RedArtistTorrentGroup[];

  if (isVariousArtists(artist)) {
    // Fallback: browse by title for Various Artists
    const browseResults = await browseTorrents({ groupname: title }, apiKey);
    groups = browseResults.map((r) => ({
      groupId: r.groupId,
      groupName: r.groupName,
      groupYear: r.groupYear,
      groupRecordLabel: '',
      groupCatalogueNumber: '',
      releaseType: releaseTypeStringToInt(r.releaseType),
      torrent: r.torrents.map((t) => ({
        id: t.torrentId,
        groupId: r.groupId,
        media: t.media,
        format: t.format,
        encoding: t.encoding,
        remasterYear: t.remasterYear,
        remastered: t.remastered,
        remasterTitle: t.remasterTitle,
        remasterRecordLabel: t.remasterRecordLabel,
        fileCount: t.fileCount,
      })),
    }));
  } else {
    try {
      const artistData = await fetchArtist(artist, apiKey);
      groups = artistData.groups;
    } catch {
      // Artist not found on RED - search requests as fallback
      const requestResults = await searchRequests(`${artist} ${title}`, apiKey).catch(() => []);
      const requests = matchRequests(requestResults);
      return makeResult('not_uploaded', 0, requests);
    }
  }

  // Helper: search requests (general text search, no group filter)
  const searchFallbackRequests = async () => {
    const term = isVariousArtists(artist) ? title : `${artist} ${title}`;
    const results = await searchRequests(term, apiKey).catch(() => []);
    return matchRequests(results);
  };

  // Step 6: Filter by release type
  const typeFiltered = filterByReleaseType(groups, release.formats);

  // Step 7: Title match
  const titleMatches = matchByTitle(typeFiltered, title);
  if (titleMatches.length === 0) {
    const requests = await searchFallbackRequests();
    return makeResult('not_uploaded', 0, requests);
  }

  // Phase 2: Fetch torrentgroup details for matched groups
  // This gives us remasterCatalogueNumber, fileList, description
  const groupDetailCache = new Map<number, RedGroupDetail>();
  const allCandidates: TorrentCandidate[] = [];

  for (const group of titleMatches) {
    const detail = await fetchTorrentGroup(group.groupId, apiKey);
    if (!detail) continue;
    groupDetailCache.set(group.groupId, detail);

    for (const torrent of detail.torrents) {
      allCandidates.push(torrentToCandidate(torrent, detail));
    }
  }

  if (allCandidates.length === 0) {
    const requests = await searchFallbackRequests();
    return makeResult('not_uploaded', 0, requests);
  }

  // Step 8: Successive narrowing
  const narrowResult = narrowCandidates(allCandidates, release);

  if (narrowResult.result === 'single') {
    const otherEditions = countOtherEditions(narrowResult.candidate, allCandidates);
    const trumpable = isEditionTrumpable(narrowResult.candidate, allCandidates);
    const requests = await fetchRequestsForGroup(narrowResult.candidate.groupName, narrowResult.candidate.groupId, apiKey);
    return makeResult('uploaded', otherEditions, requests, trumpable, narrowResult.candidate.groupId);
  }

  // Steps 10–11: Track matching (for both 'zero' and 'multiple' outcomes)
  const groupDetails = [...groupDetailCache.values()];
  const trackMatches = matchByTrackListing(release, groupDetails);

  if (trackMatches.length >= 1) {
    const otherEditions = countOtherEditions(trackMatches[0]!, allCandidates);
    const trumpable = isEditionTrumpable(trackMatches[0]!, allCandidates);
    const requests = await fetchRequestsForGroup(trackMatches[0]!.groupName, trackMatches[0]!.groupId, apiKey);
    return makeResult('uploaded', otherEditions, requests, trumpable, trackMatches[0]!.groupId);
  }

  // If title matched with multiple editions, treat as already on RED
  if (narrowResult.result === 'multiple') {
    const otherEditions = countOtherEditions(narrowResult.candidates[0]!, allCandidates);
    const trumpable = isEditionTrumpable(narrowResult.candidates[0]!, allCandidates);
    const requests = await fetchRequestsForGroup(narrowResult.candidates[0]!.groupName, narrowResult.candidates[0]!.groupId, apiKey);
    return makeResult('uploaded', otherEditions, requests, trumpable, narrowResult.candidates[0]!.groupId);
  }

  const requests = await searchFallbackRequests();
  const otherEditions = new Set(allCandidates.map(editionKeyOf)).size;
  return makeResult('not_uploaded', otherEditions, requests);
}
