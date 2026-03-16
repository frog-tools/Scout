import type { RedStatus, RedEdition, RedRequest } from '../types';

const BASE_URL = 'https://redacted.sh/ajax.php';

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
  const res = await fetch(`${BASE_URL}?${query}`, { headers: headers(apiKey) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited');
    throw new Error(`RED API error: ${res.status}`);
  }
  const data: BrowseResponse = await res.json();
  if (data.status !== 'success') throw new Error('RED API returned failure');
  return data.response.results;
}

async function searchTorrents(
  artist: string,
  title: string,
  catalogueNumber: string,
  apiKey: string,
): Promise<BrowseResponse['response']['results']> {
  // Try catalogue number first — most precise match for an edition
  if (catalogueNumber) {
    const results = await browseTorrents({ cataloguenumber: catalogueNumber }, apiKey);
    if (results.length > 0) return results;
  }

  // Fall back to general search with artist + title
  const results = await browseTorrents({ searchstr: `${artist} ${title}` }, apiKey);
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

  const res = await fetch(`${BASE_URL}?${params}`, { headers: headers(apiKey) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Rate limited');
    throw new Error(`RED API error: ${res.status}`);
  }
  const data: RequestsResponse = await res.json();
  if (data.status !== 'success') throw new Error('RED API returned failure');
  return data.response.results;
}

export async function getRedStatus(
  artist: string,
  title: string,
  catalogueNumber: string,
  apiKey: string,
): Promise<RedStatus> {
  const [torrentResults, requestResults] = await Promise.all([
    searchTorrents(artist, title, catalogueNumber, apiKey).catch(() => []),
    searchRequests(artist, title, apiKey).catch(() => []),
  ]);

  const editions: RedEdition[] = [];
  for (const group of torrentResults) {
    for (const t of group.torrents) {
      if (t.media === 'CD') {
        editions.push({
          torrentId: t.torrentId,
          format: t.format,
          encoding: t.encoding,
          media: t.media,
          seeders: t.seeders,
          snatched: t.snatched,
          remasterTitle: t.remasterTitle,
          remasterCatalogueNumber: t.remasterCatalogueNumber,
        });
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
    uploaded: editions.length > 0,
    editions,
    requestCount: requests.length,
    requests,
    checkedAt: Date.now(),
  };
}
