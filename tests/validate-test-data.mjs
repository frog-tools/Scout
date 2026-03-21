#!/usr/bin/env node
/**
 * Validates tests/test-data.json against live Discogs and RED APIs.
 * Requires .env.local with DISCOGS_API_KEY and RED_API_KEY at project root.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Read API keys from .env.local
const envContent = readFileSync(resolve(ROOT, '.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const DISCOGS_TOKEN = env.DISCOGS_API_KEY;
const RED_API_KEY = env.RED_API_KEY;

if (!DISCOGS_TOKEN || !RED_API_KEY) {
  console.error(
    'Missing DISCOGS_API_KEY or RED_API_KEY in .env.local',
  );
  process.exit(1);
}

// Read test data
const testData = JSON.parse(
  readFileSync(resolve(ROOT, 'tests/test-data.json'), 'utf-8'),
);

// -- Helpers ----------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let totalPassed = 0;
let totalFailed = 0;
let totalWarnings = 0;
const failures = [];

function pass(msg) {
  console.log(`  ✅ ${msg}`);
  totalPassed++;
}
function fail(msg, item) {
  console.log(`  ❌ ${msg}`);
  totalFailed++;
  failures.push({ barcode: item?.barcode ?? '?', msg });
}
function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
  totalWarnings++;
}
function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

// -- Rate-limited fetchers --------------------------------------------
let lastDiscogsCall = 0;
async function discogsFetch(url) {
  const elapsed = Date.now() - lastDiscogsCall;
  if (elapsed < 1050) await sleep(1050 - elapsed);
  lastDiscogsCall = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': 'ScoutTestValidator/1.0',
      Authorization: `Discogs token=${DISCOGS_TOKEN}`,
    },
  });
}

let lastRedCall = 0;
async function redFetch(params) {
  const elapsed = Date.now() - lastRedCall;
  if (elapsed < 1100) await sleep(1100 - elapsed);
  lastRedCall = Date.now();
  const query = new URLSearchParams(params);
  return fetch(`https://redacted.sh/ajax.php?${query}`, {
    headers: { Authorization: RED_API_KEY },
  });
}

// -- Extractors -------------------------------------------------------
function extractReleaseId(url) {
  const m = url.match(/\/release\/(\d+)/);
  return m ? parseInt(m[1]) : null;
}
function extractTorrentId(url) {
  const m = url.match(/torrentid=(\d+)/);
  return m ? parseInt(m[1]) : null;
}
function extractRequestId(url) {
  const m = url.match(/id=(\d+)/);
  return m ? parseInt(m[1]) : null;
}

/** Parse RED torrent time ("YYYY-MM-DD HH:MM:SS", assumed UTC) to Date */
function parseRedTime(timeStr) {
  return new Date(timeStr.replace(' ', 'T') + 'Z');
}

/** Edition key for grouping torrents into editions */
function editionKey(t) {
  return t.remastered
    ? `${t.media}|${t.remasterYear}|${t.remasterTitle}|${t.remasterRecordLabel}|${t.remasterCatalogueNumber}`
    : `${t.media}|original`;
}

/** Map test-data format key → RED torrent format+encoding */
function fmtToRed(fmt) {
  const map = {
    FLAC: { format: 'FLAC', encoding: 'Lossless' },
    '320': { format: 'MP3', encoding: '320' },
    V0: { format: 'MP3', encoding: 'V0 (VBR)' },
    FLAC24: { format: 'FLAC', encoding: '24bit Lossless' },
  };
  return map[fmt] ?? null;
}

// -- Discogs validation -----------------------------------------------
async function validateDiscogs(item, idx) {
  const { barcode, discogs } = item;
  const expectedId = extractReleaseId(discogs.release);
  const { singular, filters } = discogs.results;

  console.log(`\n-- Item ${idx + 1}: barcode ${barcode} --`);
  console.log(`   Expected: ${discogs.release} (ID ${expectedId})`);

  // Build search URL (apply filters for non-singular)
  let url = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}&type=release`;
  if (!singular && filters) {
    if (filters.format) url += `&format=${encodeURIComponent(filters.format)}`;
    if (filters.year) url += `&year=${encodeURIComponent(filters.year)}`;
    if (filters.label) url += `&label=${encodeURIComponent(filters.label)}`;
    if (filters.region) url += `&country=${encodeURIComponent(filters.region)}`;
  }

  const res = await discogsFetch(url);
  if (!res.ok) {
    fail(`Discogs search HTTP ${res.status}`, item);
    return;
  }
  const data = await res.json();
  const results = data.results ?? [];
  info(
    `Search returned ${results.length} result(s)${!singular ? ' (with filters)' : ''}`,
  );

  // Check expected release in results
  const found = results.find((r) => r.id === expectedId);
  if (found) {
    pass(`Release ${expectedId} found in search results`);
  } else {
    fail(
      `Release ${expectedId} NOT in search results (got IDs: ${results.map((r) => r.id).join(', ') || 'none'})`,
      item,
    );
    return;
  }

  // Singular check – discard 404 results first
  if (singular) {
    const validResults = [];
    for (const r of results) {
      if (r.id === expectedId) {
        validResults.push(r);
        continue;
      }
      const check = await discogsFetch(r.resource_url);
      if (check.ok) {
        validResults.push(r);
      } else {
        info(`Result ${r.id} → HTTP ${check.status}, discarded`);
      }
    }
    if (validResults.length === 1) {
      pass(`Singular confirmed (1 valid result after 404 filtering)`);
    } else {
      fail(
        `Expected singular (1 result) but got ${validResults.length} valid results: ${validResults.map((r) => r.id).join(', ')}`,
        item,
      );
    }
  }

  // Identifiers filter validation (non-singular only)
  if (!singular && filters?.identifiers) {
    const relRes = await discogsFetch(
      `https://api.discogs.com/releases/${expectedId}`,
    );
    if (!relRes.ok) {
      fail(`Could not fetch release ${expectedId} for identifiers check`, item);
    } else {
      const relData = await relRes.json();
      const vals = (relData.identifiers ?? []).map((i) => i.value ?? '');
      // Normalise whitespace for comparison
      const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = norm(filters.identifiers);
      const match = vals.some((v) => {
        const nv = norm(v);
        return nv.includes(target) || target.includes(nv);
      });
      if (match) {
        pass(`Identifiers filter "${filters.identifiers}" matched`);
      } else {
        fail(
          `Identifiers filter "${filters.identifiers}" not found in release identifiers: ${JSON.stringify(vals)}`,
          item,
        );
      }
    }
  }
}

// -- RED validation ---------------------------------------------------
async function validateRed(item, idx) {
  const { barcode, red } = item;
  console.log(`\n-- Item ${idx + 1}: barcode ${barcode} --`);

  if (red.uploaded) {
    const formats = red.formats ?? {};
    const fmtNames = Object.keys(formats);
    if (fmtNames.length === 0) {
      fail(`uploaded=true but no formats listed`, item);
      return;
    }

    // Look up first torrent → get group ID
    const firstTid = extractTorrentId(formats[fmtNames[0]].permalink);
    info(`Looking up torrent ${firstTid}…`);
    const tRes = await redFetch({ action: 'torrent', id: String(firstTid) });
    if (!tRes.ok) {
      fail(`Torrent ${firstTid} HTTP ${tRes.status}`, item);
      return;
    }
    const tData = await tRes.json();
    if (tData.status !== 'success') {
      fail(`Torrent ${firstTid} API failure`, item);
      return;
    }
    const groupId = tData.response.group.id;
    const groupName = tData.response.group.name;
    info(`Group ${groupId}: "${groupName}"`);

    // Look up torrent group (all torrents)
    const gRes = await redFetch({
      action: 'torrentgroup',
      id: String(groupId),
    });
    if (!gRes.ok) {
      fail(`Torrent group ${groupId} HTTP ${gRes.status}`, item);
      return;
    }
    const gData = await gRes.json();
    if (gData.status !== 'success') {
      fail(`Torrent group ${groupId} API failure`, item);
      return;
    }
    const allTorrents = gData.response.torrents;
    const fetchedAt = new Date(red['fetched-at']);
    const preFetch = allTorrents.filter((t) => parseRedTime(t.time) <= fetchedAt);
    const postFetch = allTorrents.filter((t) => parseRedTime(t.time) > fetchedAt);
    info(`Group has ${allTorrents.length} torrent(s) (${postFetch.length} uploaded after ${red['fetched-at']})`);

    // Verify each format permalink
    for (const [fmtName, fmtInfo] of Object.entries(formats)) {
      const tid = extractTorrentId(fmtInfo.permalink);
      const expected = fmtToRed(fmtName);
      if (!expected) {
        fail(`Unknown format key "${fmtName}"`, item);
        continue;
      }
      const t = allTorrents.find((x) => x.id === tid);
      if (!t) {
        fail(`${fmtName}: torrent ${tid} not in group ${groupId}`, item);
        continue;
      }
      // Format + encoding
      if (t.format === expected.format && t.encoding === expected.encoding) {
        pass(`${fmtName}: format OK (${t.format} / ${t.encoding})`);
      } else {
        fail(
          `${fmtName}: expected ${expected.format}/${expected.encoding}, got ${t.format}/${t.encoding}`,
          item,
        );
      }
      // Trumpable (warn instead of fail if post-fetch uploads may have changed it)
      if (t.trumpable === fmtInfo.trumpable) {
        pass(`${fmtName}: trumpable=${fmtInfo.trumpable} OK`);
      } else if (postFetch.length > 0) {
        warn(
          `${fmtName}: trumpable was ${fmtInfo.trumpable}, now ${t.trumpable} (may be due to ${postFetch.length} post-fetch upload(s))`,
        );
      } else {
        fail(
          `${fmtName}: expected trumpable=${fmtInfo.trumpable}, got ${t.trumpable}`,
          item,
        );
      }
    }

    // Count editions: only pre-fetch torrents for pass/fail
    const preFetchEditions = new Set();
    for (const t of preFetch) preFetchEditions.add(editionKey(t));

    const allEditions = new Set();
    for (const t of allTorrents) allEditions.add(editionKey(t));

    const preFetchOther = preFetchEditions.size - 1;
    const allOther = allEditions.size - 1;

    if (preFetchOther === red['other-editions']) {
      pass(`other-editions=${red['other-editions']} OK (${preFetchEditions.size} pre-fetch editions)`);
      if (allOther !== preFetchOther) {
        const newEditions = [...allEditions].filter((k) => !preFetchEditions.has(k));
        warn(
          `${allOther - preFetchOther} new edition(s) added after ${red['fetched-at']}: ${newEditions.join(' | ')}`,
        );
      }
    } else {
      fail(
        `other-editions: expected ${red['other-editions']}, got ${preFetchOther} (${preFetchEditions.size} pre-fetch editions: ${[...preFetchEditions].join(' | ')})`,
        item,
      );
    }
  } else {
    // Not uploaded
    if (red.formats) {
      fail(`uploaded=false but formats present`, item);
    } else {
      pass(`uploaded=false, no formats`);
    }
  }

  // Fillable request
  if (red['fillable-request']) {
    const link = red['request-link'];
    if (!link) {
      fail(`fillable-request=true but no request-link`, item);
    } else {
      const rid = extractRequestId(link);
      info(`Checking request ${rid}…`);
      const rRes = await redFetch({ action: 'request', id: String(rid) });
      if (!rRes.ok) {
        fail(`Request ${rid} HTTP ${rRes.status}`, item);
      } else {
        const rData = await rRes.json();
        if (rData.status !== 'success') {
          fail(`Request ${rid} API failure`, item);
        } else if (rData.response.isFilled) {
          fail(`Request ${rid} is filled (expected unfilled)`, item);
        } else {
          pass(`Request ${rid} is open/unfilled`);
        }
      }
    }
  }
}

// -- Main -------------------------------------------------------------
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Scout Test Data Validation           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n${testData.releaseTestData.length} items to validate\n`);

  console.log('═══════════ DISCOGS ═══════════');
  for (let i = 0; i < testData.releaseTestData.length; i++) {
    await validateDiscogs(testData.releaseTestData[i], i);
  }

  console.log('\n\n═══════════ RED ═══════════');
  for (let i = 0; i < testData.releaseTestData.length; i++) {
    await validateRed(testData.releaseTestData[i], i);
  }

  console.log('\n\n═══════════ SUMMARY ═══════════');
  console.log(`  ✅ Passed:   ${totalPassed}`);
  console.log(`  ❌ Failed:   ${totalFailed}`);
  console.log(`  ⚠️  Warnings: ${totalWarnings}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  • [${f.barcode}] ${f.msg}`);
    }
  }

  console.log();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
