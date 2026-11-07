import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function loadRules(rulesPath) {
  const resolved = rulesPath
    ? path.resolve(rulesPath)
    : path.join(__dirname, 'clients', 'acr.json')
  const raw = fs.readFileSync(resolved, 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data.keywords) || data.keywords.length === 0)
    throw new Error(`No keywords in rules file: ${resolved}`)
  return data
}

/**
 * @param {string} text
 * @param {{ match: string, mode?: string, case_insensitive?: boolean, reply: string }[]} keywords
 * @returns {{ match: string, reply: string } | null}
 */
export function matchKeyword(text, keywords) {
  const body = String(text || '').trim()
  if (!body) return null

  for (const rule of keywords) {
    const needle = String(rule.match || '')
    if (!needle) continue
    const mode = rule.mode || 'exact'
    const ignoreCase = rule.case_insensitive !== false
    const hay = ignoreCase ? body.toLowerCase() : body
    const pin = ignoreCase ? needle.toLowerCase() : needle

    if (mode === 'contains') {
      if (hay.includes(pin)) return { match: rule.match, reply: rule.reply }
      continue
    }

    // exact: whole comment equals keyword, or keyword as standalone token
    if (hay === pin) return { match: rule.match, reply: rule.reply }
    const tokens = hay.split(/[\s,./|!?]+/).filter(Boolean)
    if (tokens.includes(pin)) return { match: rule.match, reply: rule.reply }
  }
  return null
}

export function shouldIgnoreComment(value, rules) {
  const from = value?.from || {}
  const ignore = new Set(
    (rules.ignore_usernames || []).map((u) => String(u).toLowerCase().replace(/^@/, '')),
  )
  const username = String(from.username || '')
    .toLowerCase()
    .replace(/^@/, '')
  if (username && ignore.has(username)) return true

  const igId = rules.ig_user_id ? String(rules.ig_user_id) : ''
  if (igId && String(from.id || '') === igId) return true

  return false
}
