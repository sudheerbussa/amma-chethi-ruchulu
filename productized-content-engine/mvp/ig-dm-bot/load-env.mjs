import fs from 'node:fs'

/** Minimal .env loader (KEY=VALUE, ignores comments / blanks). */
export function loadEnvFile(filePath) {
  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    if (err?.code === 'ENOENT') return
    throw err
  }
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1)
    // Prefer .env over inherited/pm2 env so a stale APP_SECRET cannot win
    process.env[key] = val
  }
}
