/**
 * In-memory preview cache for instant screen-to-screen transitions.
 * When a user taps a property card on Search or Saved, the known fields (title, price,
 * locality, cached cover image) are stored here so PropertyDetailScreen can render
 * immediately with 0ms delay while background fetching complete details.
 */
const previewCache = new Map<string, any>();

export const setPropertyPreview = (id: string | number, data: any) => {
  if (!id || !data) return;
  previewCache.set(String(id), data);
};

export const getPropertyPreview = (id: string | number) => {
  if (!id) return null;
  return previewCache.get(String(id)) || null;
};
