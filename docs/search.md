# Release searching

Searching for releases on Discogs using barcodes, then matching these to uploads and request on RED is a _complex_ and _nuanced_ problem!
The code for doing so might also be similarly hard to follow.
These are my notes and a high-level algorithm, which were my starting point for the implementation.
They may also be a good starting point for understanding it if you want to contribute.
Note: these steps might be out of date, as I've not been very diligent about updating them as I've worked on the code.

##

1. search for barcode on discogs, this will return a list of discogs releases
2. remove any results that are any type other than "release", as well as any results that give a 404 when queried individually, directly on the /releases endpoint.
3. if only one release is returned, skip to step 5, otherwise continue
4. prompt the user to choose a release from the remaining list. allow filtering by format, year, label, and country, from all values present in the remaining list of releases. Also allow the user to specify a freeform filter for other identifiers. Note: for testing, it's sufficient to check whether the expected release is contained within results at each stage, and not that it's the only result. For testing filters, each filter field should be tested separately, then all combined.
5. look up artist name on RED to get a list of releases
6. filter results from RED by the release type known from discogs release, avoiding ambiguity when eg there's an album and a single of the same name
7. search the filtered RED results for the release title from the discogs release. If an exact match isn't found, the search should be tried again ignoring capitalisation and punctuation. this should give a torrent group.
8. successively match the following until there's only one result: media (RED) to format name (Discogs); catalogue number (RED) to catnos from labels (Discogs), which should be tried using an exact match first, then with successively looser constraints on capitalisation, spaces, punctuation, leading and trailing zeroes; label names (discogs) matched to a substring of record label (RED); format descriptions (Discogs) to a substring of edition title (RED); number of tracks, track names and lengths (Discogs) to edition title on RED; year (discogs) to edition year (RED). move immediately to step 10 if 0 matches are found at any point.
9. if there's only 1 match, count this release as "already on RED" and end early; otherwise move to the next step.
10. match the number of tracks, track names (ignoring capitalisation and punctuation) and track lengths (+/- constant offset uniformly across all tracks: max 3 s for CDs, 10s for Vinyls/Tapes) (discogs) against track listings in the release decription (RED).
11. If 1 or more releases are matched, count this release as "already on RED". If 0 releases are matched, count this release as "uploadable".

---

remember: different track ordering and different mastering don't count as separate releases on RED