/** Never silently establish a session that disappears on the next process restart. */
export async function requirePersistentSession(
  saveLocal: () => Promise<void>,
  saveIndexed: () => Promise<void>,
): Promise<void> {
  try { await saveLocal(); }
  catch { await saveIndexed(); }
}
