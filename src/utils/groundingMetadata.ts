export interface GroundingSource {
  uri?: string;
  title?: string;
}

export interface GroundingChunkLike {
  web?: GroundingSource;
  image?: {
    sourceUri?: string;
    imageUri?: string;
    title?: string;
    domain?: string;
  };
  maps?: {
    placeId?: string;
    title?: string;
    uri?: string;
    text?: string;
  };
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export type MetadataWithCitations = {
  citations?: Array<{ uri?: string }>;
} & Record<string, unknown>;

export const getGroundingChunkSource = (chunk: GroundingChunkLike): GroundingSource | undefined => {
  if (chunk.web?.uri) {
    return chunk.web;
  }

  if (chunk.image?.sourceUri) {
    return {
      uri: chunk.image.sourceUri,
      title: chunk.image.title || chunk.image.domain,
    };
  }

  if (chunk.maps?.uri) {
    return {
      uri: chunk.maps.uri,
      title: chunk.maps.title,
    };
  }

  return undefined;
};

const mergeUniqueStrings = (existing: unknown, incoming: unknown): string[] | undefined => {
  const existingValues = Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === 'string')
    : [];
  const incomingValues = Array.isArray(incoming)
    ? incoming.filter((value): value is string => typeof value === 'string')
    : [];

  if (existingValues.length === 0 && incomingValues.length === 0) {
    return undefined;
  }

  return Array.from(new Set([...existingValues, ...incomingValues]));
};

const mergeUniqueItems = <T>(existing: unknown, incoming: unknown, getKey: (item: T) => string): T[] | undefined => {
  const existingValues = Array.isArray(existing)
    ? existing.filter((value): value is T => value !== null && value !== undefined)
    : [];
  const incomingValues = Array.isArray(incoming)
    ? incoming.filter((value): value is T => value !== null && value !== undefined)
    : [];

  if (existingValues.length === 0 && incomingValues.length === 0) {
    return undefined;
  }

  const merged = new Map<string, T>();
  for (const item of [...existingValues, ...incomingValues]) {
    merged.set(getKey(item), item);
  }

  return Array.from(merged.values());
};

export const mergeGroundingMetadata = (
  existing: MetadataWithCitations | undefined,
  incoming: unknown,
): MetadataWithCitations | undefined => {
  if (!isRecord(incoming)) {
    return existing;
  }

  const merged: MetadataWithCitations = existing ? { ...existing } : {};

  for (const [key, value] of Object.entries(incoming)) {
    switch (key) {
      case 'webSearchQueries':
      case 'imageSearchQueries': {
        const mergedStrings = mergeUniqueStrings(merged[key], value);
        if (mergedStrings) {
          merged[key] = mergedStrings;
        }
        break;
      }
      case 'groundingChunks':
      case 'groundingSupports': {
        const mergedItems = mergeUniqueItems<Record<string, unknown>>(merged[key], value, (item) =>
          JSON.stringify(item),
        );
        if (mergedItems) {
          merged[key] = mergedItems;
        }
        break;
      }
      case 'citations': {
        const mergedCitations = mergeUniqueItems<Record<string, unknown>>(merged.citations, value, (item) => {
          const uri = typeof item.uri === 'string' ? item.uri : '';
          return uri || JSON.stringify(item);
        }) as Array<{ uri?: string }> | undefined;
        if (mergedCitations) {
          merged.citations = mergedCitations;
        }
        break;
      }
      default: {
        if (isRecord(value) && isRecord(merged[key])) {
          merged[key] = { ...(merged[key] as Record<string, unknown>), ...value };
        } else {
          merged[key] = value;
        }
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

export interface MapsPlace {
  uri: string;
  title: string;
}

/**
 * Extracts Maps grounding chunks as structured place entries.
 * Returns an empty array when the metadata has no Maps chunks.
 */
export const extractMapsPlaces = (metadata: unknown): MapsPlace[] => {
  if (!isRecord(metadata) || !Array.isArray(metadata.groundingChunks)) {
    return [];
  }

  const places: MapsPlace[] = [];
  const seen = new Set<string>();

  for (const chunk of metadata.groundingChunks) {
    if (!isRecord(chunk) || !isRecord(chunk.maps)) continue;
    const maps = chunk.maps as GroundingChunkLike['maps'];
    if (!maps?.uri || seen.has(maps.uri)) continue;
    seen.add(maps.uri);
    places.push({ uri: maps.uri, title: maps.title || maps.uri });
  }

  return places;
};
