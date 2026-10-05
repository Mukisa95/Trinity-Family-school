// Academic periods can contain legacy plain timestamp maps as well as SDK
// Timestamps. Normalize both before applying the same date rules as the UI.
function isoValues(value) {
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (keys.length && keys.every(key => ['seconds', 'nanoseconds', '_seconds', '_nanoseconds'].includes(key))
      && Number.isInteger(seconds) && Number.isInteger(nanoseconds) && nanoseconds >= 0 && nanoseconds < 1e9) {
      const date = new Date(seconds * 1000 + nanoseconds / 1e6);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
  }
  if (Array.isArray(value)) return value.map(isoValues);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isoValues(item)]),
  );
  return value;
}

module.exports = {isoValues};
