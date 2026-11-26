export function hasTripEntries({ currency, segments, hotels, previous, documents, ...fields }) {
  const hasValue = (value) => typeof value === 'string' && value !== '';
  return currency === 'LOCAL' ||
    Object.values(fields).some(hasValue) ||
    [segments, hotels, previous].some((rows) => rows.some((row) => Object.values(row).some(hasValue))) ||
    Object.values(documents).some(Boolean);
}
