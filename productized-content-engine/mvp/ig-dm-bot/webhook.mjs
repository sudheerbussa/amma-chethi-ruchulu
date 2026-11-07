/**
 * Normalize Instagram / Page comment webhook payloads into comment events.
 */
export function extractCommentEvents(payload) {
  const out = []
  const entries = payload?.entry
  if (!Array.isArray(entries)) return out

  for (const entry of entries) {
    const changes = entry.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      if (change?.field !== 'comments' && change?.field !== 'live_comments') continue
      const value = change.value
      if (!value?.id) continue
      out.push({
        commentId: String(value.id),
        text: value.text || value.message || '',
        from: value.from || {},
        mediaId: value.media?.id || value.media_id || null,
        field: change.field,
        entryId: entry.id,
      })
    }
  }
  return out
}
