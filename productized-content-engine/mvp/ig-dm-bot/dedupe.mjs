import fs from 'node:fs'
import path from 'node:path'

const MAX_ENTRIES = 5000

export function createDedupe(filePath) {
  const storePath = path.resolve(filePath)
  /** @type {Set<string>} */
  let ids = new Set()

  function load() {
    try {
      const raw = fs.readFileSync(storePath, 'utf8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) ids = new Set(arr.map(String))
    } catch (err) {
      if (err && err.code !== 'ENOENT') console.error('dedupe load', err.message)
      ids = new Set()
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(storePath), { recursive: true })
    let list = [...ids]
    if (list.length > MAX_ENTRIES) list = list.slice(-MAX_ENTRIES)
    fs.writeFileSync(storePath, JSON.stringify(list), 'utf8')
  }

  load()

  return {
    has(id) {
      return ids.has(String(id))
    },
    add(id) {
      ids.add(String(id))
      save()
    },
  }
}
