#!/usr/bin/env node
/**
 * Instagram carousel publisher via Meta Graph API.
 *
 * Usage:
 *   node post-carousel.mjs --dir /data/clients/acr/2026-09-15/carousel
 *
 * Expects in --dir:
 *   01.png (or .jpg) … N.png
 *   caption.txt
 *   meta.json (optional; updated on success)
 *
 * Env (.env next to this file or process env):
 *   IG_USER_ID          Instagram Business/Creator user id
 *   ACCESS_TOKEN        Page access token with instagram_content_publish
 *   GRAPH_API_VERSION   default v21.0
 *   PUBLIC_BASE_URL     e.g. https://order.ammachethiruchulu.co.in/ig-staging
 *   STAGING_DIR         default /data/ig-staging
 */
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  return process.argv[i + 1] ?? fallback
}

function requiredEnv(key) {
  const v = process.env[key]
  if (!v) {
    console.error(`Missing env ${key}. Copy .env.example → .env and fill tokens.`)
    process.exit(1)
  }
  return v
}

const dir = path.resolve(arg('dir', ''))
if (!dir || dir === process.cwd()) {
  console.error('Usage: node post-carousel.mjs --dir /path/to/carousel')
  process.exit(1)
}

const IG_USER_ID = requiredEnv('IG_USER_ID')
const ACCESS_TOKEN = requiredEnv('ACCESS_TOKEN')
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0'
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
const STAGING_DIR = process.env.STAGING_DIR || '/data/ig-staging'
const KEEP_STAGING = process.argv.includes('--keep-staging')

if (!PUBLIC_BASE_URL) {
  console.error('Missing PUBLIC_BASE_URL (public HTTPS base Meta can fetch)')
  process.exit(1)
}

const graph = `https://graph.facebook.com/${GRAPH_API_VERSION}`

async function graphPost(pathname, params) {
  const body = new URLSearchParams({ ...params, access_token: ACCESS_TOKEN })
  const res = await fetch(`${graph}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok || json.error) {
    const msg = json.error?.message || JSON.stringify(json)
    throw new Error(`Graph POST ${pathname}: ${msg}`)
  }
  return json
}

async function graphGet(pathname, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: ACCESS_TOKEN })
  const res = await fetch(`${graph}${pathname}?${qs}`)
  const json = await res.json()
  if (!res.ok || json.error) {
    const msg = json.error?.message || JSON.stringify(json)
    throw new Error(`Graph GET ${pathname}: ${msg}`)
  }
  return json
}

async function waitForContainer(creationId, label) {
  const deadline = Date.now() + 3 * 60 * 1000
  while (Date.now() < deadline) {
    const st = await graphGet(`/${creationId}`, { fields: 'status_code,status' })
    const code = st.status_code || st.status
    if (code === 'FINISHED') return
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`Container ${label} failed: ${JSON.stringify(st)}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Timeout waiting for container ${label}`)
}

async function listSlides(carouselDir) {
  const names = await readdir(carouselDir)
  const slides = names
    .filter((n) => /^(0[1-9]|[1-9][0-9])\.(png|jpe?g|webp)$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (slides.length < 2) {
    throw new Error(`Need at least 2 slides in ${carouselDir} (found ${slides.length})`)
  }
  if (slides.length > 10) {
    throw new Error(`Instagram carousel max 10 images (found ${slides.length})`)
  }
  return slides
}

async function stageJpegs(carouselDir, slides, jobId) {
  const outDir = path.join(STAGING_DIR, jobId)
  await mkdir(outDir, { recursive: true })
  const publicPaths = []

  let i = 0
  for (const name of slides) {
    i += 1
    const src = path.join(carouselDir, name)
    const destName = `${String(i).padStart(2, '0')}.jpg`
    const dest = path.join(outDir, destName)
    await sharp(src)
      .resize(1080, 1080, { fit: 'cover' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(dest)
    publicPaths.push(`${PUBLIC_BASE_URL}/${jobId}/${destName}`)
    console.log('staged', destName)
  }
  return { outDir, publicPaths }
}

async function main() {
  const slides = await listSlides(dir)
  const captionPath = path.join(dir, 'caption.txt')
  let caption = ''
  try {
    caption = (await readFile(captionPath, 'utf8')).trim()
  } catch {
    console.warn('No caption.txt — posting without caption')
  }

  const jobId = randomUUID().slice(0, 8)
  console.log('job', jobId, 'slides', slides.length)

  const { outDir, publicPaths } = await stageJpegs(dir, slides, jobId)

  // Smoke-check first URL is reachable publicly (Meta will fetch similarly)
  const probe = await fetch(publicPaths[0], { method: 'HEAD' })
  if (!probe.ok) {
    throw new Error(
      `Staging URL not reachable (${probe.status}): ${publicPaths[0]}\n` +
        'Fix Caddy /ig-staging route and ensure files are under STAGING_DIR.',
    )
  }
  console.log('public URL ok:', publicPaths[0])

  const childIds = []
  for (let i = 0; i < publicPaths.length; i++) {
    const imageUrl = publicPaths[i]
    const created = await graphPost(`/${IG_USER_ID}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
    })
    console.log('item container', i + 1, created.id)
    await waitForContainer(created.id, `item-${i + 1}`)
    childIds.push(created.id)
  }

  const carousel = await graphPost(`/${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  })
  console.log('carousel container', carousel.id)
  await waitForContainer(carousel.id, 'carousel')

  const published = await graphPost(`/${IG_USER_ID}/media_publish`, {
    creation_id: carousel.id,
  })
  console.log('published media id', published.id)

  const metaPath = path.join(dir, 'meta.json')
  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf8'))
    meta.status = 'posted'
    meta.posted_at = new Date().toISOString()
    meta.ig_media_id = published.id
    meta.ig_creation_id = carousel.id
    await writeFile(metaPath, JSON.stringify(meta, null, 2))
  } catch {
    // ignore
  }

  if (!KEEP_STAGING) {
    await rm(outDir, { recursive: true, force: true })
    console.log('cleaned staging', outDir)
  } else {
    console.log('kept staging', outDir)
  }

  console.log('DONE')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
