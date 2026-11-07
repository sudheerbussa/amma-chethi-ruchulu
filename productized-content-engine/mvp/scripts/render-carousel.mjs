#!/usr/bin/env node
/**
 * Render a carousel JSON → queue/<client>/<date>/carousel/*.png
 * Usage:
 *   node scripts/render-carousel.mjs --input clients/acr/sample-carousel.json --client acr
 */
import { readFile, mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  return process.argv[i + 1] ?? fallback
}

async function loadAvatarDataUrl(profile, clientId) {
  const candidates = [
    profile.profile_image,
    `clients/${clientId}/profile.png`,
    `clients/${clientId}/profile.jpg`,
    `clients/${clientId}/assets/profile.png`,
    `clients/${clientId}/assets/profile.jpg`,
  ].filter(Boolean)

  for (const rel of candidates) {
    const abs = path.resolve(root, rel.startsWith('clients/') ? rel : path.join('clients', clientId, rel.replace(/^\.\//, '')))
    // also try relative to client folder when path is ./assets/...
    const tries = [
      abs,
      path.resolve(root, 'clients', clientId, rel.replace(/^\.\//, '')),
      path.resolve(root, rel),
    ]
    for (const file of tries) {
      try {
        await access(file)
        const buf = await readFile(file)
        const ext = path.extname(file).toLowerCase()
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
        return `data:${mime};base64,${buf.toString('base64')}`
      } catch {
        // try next
      }
    }
  }
  return null
}

function templatePathFor(profile) {
  const key = profile.template || 'tweet_card_healthy'
  if (key === 'tweet_card_dark') return path.resolve(root, 'templates/tweet-card/slide.html')
  return path.resolve(root, 'templates/tweet-card-healthy/slide.html')
}

const inputRel = arg('input', 'clients/acr/sample-carousel.json')
const clientId = arg('client', 'acr')
const date = arg('date', new Date().toISOString().slice(0, 10))

const inputPath = path.resolve(root, inputRel)
const profilePath = path.resolve(root, 'clients', clientId, 'profile.json')
const outDir = path.resolve(root, 'queue', clientId, date, 'carousel')

const carousel = JSON.parse(await readFile(inputPath, 'utf8'))
const profile = JSON.parse(await readFile(profilePath, 'utf8'))
const templatePath = templatePathFor(profile)
const avatarDataUrl = await loadAvatarDataUrl(profile, clientId)

if (!avatarDataUrl) console.warn('No profile image found — avatar will be blank')
else console.log('Loaded profile image for avatar')

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 1,
})

await page.goto(`file://${templatePath}`)

const colors = profile.colors || {}
let i = 0
for (const slide of carousel.slides) {
  i += 1
  const n = String(i).padStart(2, '0')
  await page.evaluate((payload) => {
    window.__setSlide(payload)
  }, {
    displayName: profile.display_name,
    text: slide.text,
    subline: profile.subline || 'Healthy home habits',
    ctaLabel: slide.role === 'cta' ? 'MENU comment >' : 'Continue >',
    avatarDataUrl,
    bg: colors.bg,
    cardBg: colors.card,
    textColor: colors.text,
    nameColor: colors.text,
    accent: colors.accent,
  })
  await page.screenshot({
    path: path.join(outDir, `${n}.png`),
    type: 'png',
  })
  console.log('wrote', `${n}.png`)
}

await writeFile(path.join(outDir, 'caption.txt'), carousel.caption || '', 'utf8')
await writeFile(
  path.join(outDir, 'meta.json'),
  JSON.stringify({
    client_id: clientId,
    platform: 'instagram',
    type: 'carousel',
    theme: profile.template || 'tweet_card_healthy',
    publish_at: null,
    status: 'ready',
    slide_count: carousel.slides.length,
    cta_keyword: profile.cta_keyword,
    hashtags: carousel.hashtags || [],
  }, null, 2),
  'utf8',
)

await browser.close()
console.log('done →', outDir)
console.log('Next: set publish_at in meta.json, then follow VPS_PUBLISH.md')
