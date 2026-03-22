import React, { useState, useMemo } from 'react';
import { View, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Menu, Text, TextInput, Divider, useTheme, type MD3Theme } from 'react-native-paper';
import type { DiscogsSearchResult } from '../types';
import { parseArtistTitle, stripDiscogsDisambiguator } from '../services/discogs';

interface ReleasePickerProps {
  visible: boolean;
  candidates: DiscogsSearchResult[];
  coverMap: Map<number, string>;
  onSelect: (result: DiscogsSearchResult) => void;
  onDismiss: () => void;
}

/** Extract unique non-empty values from an array accessor on candidates. */
function uniqueValues(
  candidates: DiscogsSearchResult[],
  accessor: (c: DiscogsSearchResult) => string | undefined,
): string[] {
  const set = new Set<string>();
  for (const c of candidates) {
    const v = accessor(c);
    if (v) set.add(v);
  }
  return [...set].sort();
}

function uniqueLabels(candidates: DiscogsSearchResult[]): string[] {
  const set = new Set<string>();
  for (const c of candidates) {
    for (const l of c.label ?? []) {
      const stripped = stripDiscogsDisambiguator(l);
      if (stripped) set.add(stripped);
    }
  }
  return [...set].sort();
}

interface Filters {
  title: string | null;
  artist: string | null;
  format: string | null;
  year: string | null;
  label: string | null;
  country: string | null;
}

const emptyFilters: Filters = { title: null, artist: null, format: null, year: null, label: null, country: null };

export default function ReleasePicker({
  visible,
  candidates,
  coverMap,
  onSelect,
  onDismiss,
}: ReleasePickerProps) {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  // Reset filters when candidates change (new scan)
  const [prevCandidates, setPrevCandidates] = useState(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    setFilters(emptyFilters);
  }

  // Apply a subset of filters (excluding one key) to get candidates for that key's dropdown
  const applyFilters = useMemo(() => {
    const parsed = new Map(candidates.map((c) => [c.id, parseArtistTitle(c.title)] as const));
    const matchesTitle = (c: DiscogsSearchResult) => !filters.title || parsed.get(c.id)?.title === filters.title;
    const matchesArtist = (c: DiscogsSearchResult) => !filters.artist || parsed.get(c.id)?.artist === filters.artist;
    const matchesFormat = (c: DiscogsSearchResult) => !filters.format || c.format[0] === filters.format;
    const matchesYear = (c: DiscogsSearchResult) => !filters.year || c.year === filters.year;
    const matchesLabel = (c: DiscogsSearchResult) => !filters.label || (c.label ?? []).some(
      (l) => stripDiscogsDisambiguator(l) === filters.label,
    );
    const matchesCountry = (c: DiscogsSearchResult) => !filters.country || c.country === filters.country;

    const allDropdown = [matchesTitle, matchesArtist, matchesFormat, matchesYear, matchesLabel, matchesCountry];
    const without = (skip: number) => candidates.filter((c) => allDropdown.every((fn, i) => i === skip || fn(c)));

    return {
      all: candidates.filter((c) => allDropdown.every((fn) => fn(c))),
      exceptTitle: without(0),
      exceptArtist: without(1),
      exceptFormat: without(2),
      exceptYear: without(3),
      exceptLabel: without(4),
      exceptCountry: without(5),
    };
  }, [candidates, filters]);

  const filtered = applyFilters.all;

  // Each dropdown shows values from candidates filtered by the OTHER active filters
  const titles = uniqueValues(applyFilters.exceptTitle, (c) => parseArtistTitle(c.title).title || undefined);
  const artists = uniqueValues(applyFilters.exceptArtist, (c) => parseArtistTitle(c.title).artist || undefined);
  const formats = uniqueValues(applyFilters.exceptFormat, (c) => c.format[0]);
  const years = uniqueValues(applyFilters.exceptYear, (c) => c.year || undefined);
  const labels = uniqueLabels(applyFilters.exceptLabel);
  const countries = uniqueValues(applyFilters.exceptCountry, (c) => c.country);

  const setFilter = (key: keyof Filters, value: string | null) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const hasActiveFilters = filters.title || filters.artist || filters.format || filters.year || filters.label || filters.country;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Choose pressing</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            {/* Filters */}
            <View style={styles.filterSection}>
              <FilterDropdown
                label="Format"
                values={formats}
                selected={filters.format}
                onSelect={(v) => setFilter('format', v)}
              />
              <FilterDropdown
                label="Year"
                values={years}
                selected={filters.year}
                onSelect={(v) => setFilter('year', v)}
              />
              <FilterDropdown
                label="Country"
                values={countries}
                selected={filters.country}
                onSelect={(v) => setFilter('country', v)}
              />
              <FilterDropdown
                label="Title"
                values={titles}
                selected={filters.title}
                onSelect={(v) => setFilter('title', v)}
              />
              <FilterDropdown
                label="Artist"
                values={artists}
                selected={filters.artist}
                onSelect={(v) => setFilter('artist', v)}
              />
              <FilterDropdown
                label="Label"
                values={labels}
                selected={filters.label}
                onSelect={(v) => setFilter('label', v)}
              />
            </View>
            <Divider />

            {/* Results */}
            {filtered.length > 0 && (
              <Text variant="labelSmall" style={[styles.resultCount, { color: theme.colors.onSurfaceVariant }]}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </Text>
            )}
            {filtered.map((candidate, index) => {
              const { artist, title } = parseArtistTitle(candidate.title);
              const cover = coverMap.get(candidate.id);
              const strippedLabels = [...new Set(
                (candidate.label ?? [])
                  .map(stripDiscogsDisambiguator)
                  .filter(Boolean),
              )];
              return (
                <React.Fragment key={candidate.id}>
                  {index > 0 && <Divider />}
                  <Pressable
                    onPress={() => onSelect(candidate)}
                    style={({ pressed }) => [
                      styles.item,
                      pressed && { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <View style={styles.itemRow}>
                      {cover ? (
                        <Image source={{ uri: cover }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]} />
                      )}
                      <View style={styles.itemContent}>
                        <Text variant="titleSmall" numberOfLines={1}>{title}</Text>
                        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                          {artist}
                        </Text>
                        <View style={styles.detailBlock}>
                          {strippedLabels.length > 0 && (
                            <InfoRow label="Label" value={strippedLabels.join(', ')} theme={theme} />
                          )}
                          {candidate.catno ? (
                            <InfoRow label="Cat#" value={candidate.catno} theme={theme} />
                          ) : null}
                          <InfoRow label="Format" value={candidate.format.join(', ') || 'Unknown'} theme={theme} />
                          {candidate.country ? (
                            <InfoRow label="Country" value={candidate.country} theme={theme} />
                          ) : null}
                          {candidate.year ? (
                            <InfoRow label="Year" value={candidate.year} theme={theme} />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })}

            {filtered.length === 0 && (
              <Text
                variant="bodyMedium"
                style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
              >
                No releases match the current filters
              </Text>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {hasActiveFilters ? (
            <Button onPress={() => setFilters(emptyFilters)}>Clear filters</Button>
          ) : null}
          <Button onPress={onDismiss}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function InfoRow({ label, value, theme }: {
  label: string;
  value: string;
  theme: MD3Theme;
}) {
  return (
    <View style={styles.infoRow}>
      <Text variant="labelSmall" style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text
        variant="bodySmall"
        style={[styles.infoValue, { color: theme.colors.onSurfaceVariant }]}
      >
        {value}
      </Text>
    </View>
  );
}

function FilterDropdown({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  if (values.length === 0 && !selected) return null;

  return (
    <View>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Pressable onPress={() => setOpen(true)}>
            <TextInput
              mode="outlined"
              label={label}
              value={selected ?? 'All'}
              dense
              editable={false}
              right={<TextInput.Icon icon="menu-down" onPress={() => setOpen(true)} />}
              pointerEvents="none"
            />
          </Pressable>
        }
      >
        <Menu.Item
          title="All"
          onPress={() => { onSelect(null); setOpen(false); }}
          titleStyle={!selected ? { fontWeight: '700' } : undefined}
        />
        {values.map((v) => (
          <Menu.Item
            key={v}
            title={v}
            onPress={() => { onSelect(v); setOpen(false); }}
            titleStyle={selected === v ? { fontWeight: '700' } : undefined}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  filterSection: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 8,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  detailBlock: {
    marginTop: 4,
    gap: 2,
  },
  resultCount: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoLabel: {
    width: 56,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    flexShrink: 1,
  },
  emptyText: {
    textAlign: 'center',
    padding: 24,
  },
});
