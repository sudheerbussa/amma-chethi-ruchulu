/**
 * Send one Instagram private reply to a commenter (Facebook Login / Page token).
 * @see https://developers.facebook.com/docs/instagram-platform/private-replies
 */

export async function sendPrivateReply({
  pageId,
  accessToken,
  commentId,
  text,
  apiVersion = 'v21.0',
}) {
  if (!pageId || !accessToken || !commentId || !text)
    throw new Error('sendPrivateReply: missing pageId, accessToken, commentId, or text')

  const url = new URL(`https://graph.facebook.com/${apiVersion}/${pageId}/messages`)
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: String(commentId) },
      message: { text: String(text) },
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText
    const err = new Error(`Graph private reply failed: ${msg}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}
