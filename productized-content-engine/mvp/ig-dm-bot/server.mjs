import crypto from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDedupe } from './dedupe.mjs'
import { loadEnvFile } from './load-env.mjs'
import { sendPrivateReply } from './private-reply.mjs'
import { loadRules, matchKeyword, shouldIgnoreComment } from './rules.mjs'
import { extractCommentEvents } from './webhook.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(__dirname, '.env'))

function requireEnv(key) {
  const v = process.env[key]
  if (!v || !String(v).trim()) {
    console.error(`Missing env ${key}. Copy .env.example → .env and fill values.`)
    process.exit(1)
  }
  return String(v).trim()
}

const PAGE_ID = requireEnv('PAGE_ID')
const ACCESS_TOKEN = requireEnv('ACCESS_TOKEN')
const VERIFY_TOKEN = requireEnv('VERIFY_TOKEN')
const APP_SECRET = (process.env.APP_SECRET || '').trim()
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0'
const PORT = Number(process.env.PORT || 3010)
const RULES_PATH = process.env.RULES_PATH || path.join(__dirname, 'clients', 'acr.json')
const DEDUPE_PATH =
  process.env.DEDUPE_PATH || path.join(__dirname, 'data', 'processed-comments.json')
const SKIP_SIGNATURE = process.env.SKIP_SIGNATURE === '1'

const rules = loadRules(RULES_PATH)
const dedupe = createDedupe(DEDUPE_PATH)

function verifySignature(rawBody, headerValue) {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue
  if (!header || typeof header !== 'string') return { ok: false, reason: 'missing_header' }
  if (!header.startsWith('sha256=')) return { ok: false, reason: 'not_sha256', headerPrefix: header.slice(0, 12) }
  const expected = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
  const got = header.slice('sha256='.length).trim()
  if (expected.length !== got.length)
    return { ok: false, reason: 'length_mismatch', expectedLen: expected.length, gotLen: got.length }
  try {
    const ok = crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(got, 'utf8'))
    return ok ? { ok: true } : { ok: false, reason: 'mismatch', bodyLen: rawBody.length, secretLen: APP_SECRET.length }
  } catch (err) {
    return { ok: false, reason: 'compare_error', message: err.message }
  }
}

async function handleComment(event) {
  const { commentId, text, from } = event
  if (dedupe.has(commentId)) {
    console.log('skip dedupe', commentId)
    return
  }
  if (shouldIgnoreComment({ from }, rules)) {
    console.log('skip ignore', commentId, from?.username || from?.id)
    return
  }
  const hit = matchKeyword(text, rules.keywords)
  if (!hit) {
    console.log('skip no-keyword', commentId, JSON.stringify(text).slice(0, 80))
    return
  }

  // Mark before send to avoid double-send on webhook retries; remove on hard failure? keep on fail to avoid loops — log only
  dedupe.add(commentId)
  console.log('private-reply', commentId, 'keyword', hit.match)

  try {
    const result = await sendPrivateReply({
      pageId: PAGE_ID,
      accessToken: ACCESS_TOKEN,
      commentId,
      text: hit.reply,
      apiVersion: GRAPH_API_VERSION,
    })
    console.log('private-reply ok', commentId, result?.message_id || result)
  } catch (err) {
    console.error('private-reply error', commentId, err.message, err.body || '')
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (
    req.method === 'GET' &&
    (url.pathname === '/health' || url.pathname === '/' || url.pathname === '/health-ig-dm')
  ) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'ig-dm-bot' }))
    return
  }

  // Meta webhook verification
  if (req.method === 'GET' && url.pathname === '/webhooks/instagram') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      console.log('webhook verified')
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(challenge)
      return
    }
    res.writeHead(403).end('Forbidden')
    return
  }

  if (req.method === 'POST' && url.pathname === '/webhooks/instagram') {
    let raw
    try {
      raw = await readRawBody(req)
    } catch {
      res.writeHead(400).end('bad body')
      return
    }

    const sig =
      req.headers['x-hub-signature-256'] || req.headers['X-Hub-Signature-256']
    if (!SKIP_SIGNATURE) {
      if (!APP_SECRET) {
        console.error('APP_SECRET missing — set it or SKIP_SIGNATURE=1 for local tests only')
        res.writeHead(500).end('Server misconfigured')
        return
      }
      const check = verifySignature(raw, sig)
      if (!check.ok) {
        console.error('bad signature', check)
        res.writeHead(401).end('Invalid signature')
        return
      }
    } else {
      console.warn('SKIP_SIGNATURE=1 — accepting unsigned webhook (dev only)')
    }

    // Always ACK fast
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('EVENT_RECEIVED')

    let payload
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      console.error('invalid json webhook')
      return
    }

    const events = extractCommentEvents(payload)
    for (const event of events) {
      handleComment(event).catch((err) => console.error('handleComment', err))
    }
    return
  }

  res.writeHead(404).end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ig-dm-bot listening on 127.0.0.1:${PORT}`)
  console.log(`rules ${RULES_PATH} keywords=${rules.keywords.length}`)
  console.log(`APP_SECRET loaded len=${APP_SECRET.length} skip_sig=${SKIP_SIGNATURE}`)
})
