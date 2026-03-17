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
  addedAt: number;
  redStatus?: RedStatus;
}

export interface DiscogsSearchResult {
  id: number;
  title: string;
  year: string;
  thumb: string;
  cover_image: string;
  genre: string[];
  format: string[];
  catno: string;
  resource_url: string;
  type: string;
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

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  discogsToken: string;
  themeMode: ThemeMode;
  redApiKey: string;
}

// RED (Redacted) types

export interface RedRequest {
  requestId: number;
  title: string;
  year: number;
  bounty: number;
  formatList: string;
}

export interface RedStatus {
  uploaded: boolean;
  otherEditionCount: number;
  requestCount: number;
  requests: RedRequest[];
  checkedAt: number;
}
