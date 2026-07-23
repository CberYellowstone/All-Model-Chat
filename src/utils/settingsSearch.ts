import { translations } from '@/i18n/coreTranslations';
import { SETTINGS_SEARCH_CATALOG, type SettingsSearchEntry } from '@/constants/settingsSearchCatalog';

const normalizeQuery = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const collectTextsForKey = (key: string, resolveText: (key: string) => string): string[] => {
  const texts = new Set<string>();
  const live = resolveText(key);
  if (live && live !== key) {
    texts.add(live);
  }

  const entry = translations[key];
  if (entry) {
    if (entry.en) texts.add(entry.en);
    if (entry.zh) texts.add(entry.zh);
  }

  return Array.from(texts);
};

const entryMatchesQuery = (
  entry: SettingsSearchEntry,
  query: string,
  resolveText: (key: string) => string,
): boolean => {
  const haystackParts = [
    ...collectTextsForKey(entry.labelKey, resolveText),
    ...(entry.descriptionKey ? collectTextsForKey(entry.descriptionKey, resolveText) : []),
    ...(entry.groupKey ? collectTextsForKey(entry.groupKey, resolveText) : []),
    entry.id.replace(/[-_]/g, ' '),
  ];

  const haystack = normalizeQuery(haystackParts.join(' '));
  return haystack.includes(query);
};

export interface SettingsSearchResult extends SettingsSearchEntry {
  label: string;
  groupLabel?: string;
  description?: string;
}

/**
 * Filter the settings search catalog by a free-text query.
 * Matches against current-language and bilingual label/description text.
 */
export const searchSettingsCatalog = (
  rawQuery: string,
  resolveText: (key: string) => string,
  catalog: SettingsSearchEntry[] = SETTINGS_SEARCH_CATALOG,
): SettingsSearchResult[] => {
  const query = normalizeQuery(rawQuery);
  if (!query) {
    return [];
  }

  return catalog
    .filter((entry) => entryMatchesQuery(entry, query, resolveText))
    .map((entry) => ({
      ...entry,
      label: resolveText(entry.labelKey),
      groupLabel: entry.groupKey ? resolveText(entry.groupKey) : undefined,
      description: entry.descriptionKey ? resolveText(entry.descriptionKey) : undefined,
    }));
};
