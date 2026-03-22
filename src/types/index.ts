// -- Album (persisted) ----------------------------------------------

export interface Album {
  id: string;
  discogsId: number;
  barcode: string;
  title: string;
  artist: string;
  year: number | null;
  thumb: string;
  coverImage: string;
  genre: string[];
  format: string[];
  catalogNumber: string;
  country?: string;
  addedAt: number;
  redStatus?: RedStatus;
}

// -- Discogs types --------------------------------------------------

export interface DiscogsSearchResult {
  id: number;
  title: string;           // "Artist - Title"
  year: string;
  thumb: string;
  cover_image: string;
  genre: string[];
  format: string[];        // From search: ["CD", "Album"]
  catno: string;
  resource_url: string;
  type: string;            // "release", "master", etc.
  country?: string;
  label?: string[];
}

export interface DiscogsSearchResponse {
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
  results: DiscogsSearchResult[];
}

export interface DiscogsTrack {
  position: string;
  type_: string;           // "track", "heading", "index"
  title: string;
  duration: string;        // "3:45" or ""
}

export interface DiscogsLabel {
  name: string;
  catno: string;
}

export interface DiscogsFormat {
  name: string;            // "CD", "Vinyl", "Cassette"
  qty: string;
  descriptions?: string[]; // ["Album", "Reissue", "Remastered"]
}

export interface DiscogsIdentifier {
  type: string;            // "Barcode", "Matrix / Runout", etc.
  value: string;
}

export interface DiscogsArtistCredit {
  name: string;
  anv: string;             // Artist Name Variation (display name)
  join: string;
  id: number;
}

export interface DiscogsReleaseDetail {
  id: number;
  title: string;
  year: number | null;
  country: string;
  formats: DiscogsFormat[];
  labels: DiscogsLabel[];
  identifiers: DiscogsIdentifier[];
  tracklist: DiscogsTrack[];
  artists: DiscogsArtistCredit[];
  images?: { type: string; uri: string; uri150: string }[];
  artistDisplay: string;   // Resolved by resolveArtistName()
  barcode: string;         // Set by caller (scanned barcode)
}

// -- RED (Redacted) types -------------------------------------------

// From action=artist - torrentgroup[].torrent[] (singular key!)
export interface RedArtistTorrent {
  id: number;
  groupId: number;
  media: string;
  format: string;
  encoding: string;
  remasterYear: number;
  remastered: boolean;
  remasterTitle: string;
  remasterRecordLabel: string;
  // NOTE: remasterCatalogueNumber is NOT in this endpoint
  fileCount: number;
}

export interface RedArtistTorrentGroup {
  groupId: number;
  groupName: string;
  groupYear: number;
  groupRecordLabel: string;
  groupCatalogueNumber: string;
  releaseType: number;     // 1=Album, 5=EP, 7=Compilation, 9=Single, etc.
  torrent: RedArtistTorrent[];  // singular "torrent" key from API
}

export interface RedArtistRequest {
  requestId: number;
  title: string;
  year: number;
  bounty: number;
}

// From action=torrentgroup - torrents[] (plural key!)
export interface RedGroupTorrent {
  id: number;
  media: string;
  format: string;
  encoding: string;
  remastered: boolean;
  remasterYear: number;
  remasterTitle: string;
  remasterRecordLabel: string;
  remasterCatalogueNumber: string;  // ONLY available here
  fileCount: number;
  fileList: string;
  description: string;
}

export interface RedGroupDetail {
  group: {
    id: number;
    name: string;
    year: number;
    recordLabel: string;
    catalogueNumber: string;
    releaseType: number;
    bbBody: string;
    wikiBody: string;
  };
  torrents: RedGroupTorrent[];
}

export type RedMatchResult = 'uploaded' | 'not_uploaded';

export interface RedRequest {
  requestId: number;
  title: string;
  year: number;
  bounty: number;
  formatList: string;
}

export interface RedStatus {
  result: RedMatchResult;
  uploaded: boolean;          // Backwards compat: result === 'uploaded'
  trumpable: boolean;
  otherEditionCount: number;
  requestCount: number;
  requests: RedRequest[];
  checkedAt: number;
  matchedGroupId?: number;
  matchedTorrentId?: number;
}

// -- Settings and Theme ---------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  discogsToken: string;
  themeMode: ThemeMode;
  redApiKey: string;
  frogModeActive: boolean;
  frogModeFound: boolean;
}
