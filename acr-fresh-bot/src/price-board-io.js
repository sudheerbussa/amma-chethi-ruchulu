/**
 * Price-board Excel-friendly CSV export / import.
 * Columns use rupees (not paise) so admins can edit in Excel.
 */

import { normalizeItemKey, paiseToRupees, rupeesToPaise } from './price-board.js';

export const PRICE_BOARD_CSV_HEADERS = [
  'item_key',
  'item_name',
  'category',
  'uom',
  'dish_code',
  'local_rupees',
  'blinkit_rupees',
  'instamart_rupees',
  'raithu_rupees',
  'cost_rupees',
  'acr_sell_rupees',
];

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rupeeCell(paise) {
  if (paise == null || paise === '') return '';
  const r = paiseToRupees(paise);
  if (r == null) return '';
  return Number.isInteger(r) ? String(r) : String(r);
}

/** Build UTF-8 CSV (with BOM) for Excel. */
export function priceBoardToCsv(rows, { date } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = [];
  if (date) lines.push(`# ACR Fresh price board · ${date} · edit acr_sell_rupees then Upload`);
  lines.push(PRICE_BOARD_CSV_HEADERS.join(','));
  for (const r of list) {
    lines.push(
      [
        csvEscape(r.item_key),
        csvEscape(r.item_name),
        csvEscape(r.category === 'fruits' ? 'fruits' : 'vegetables'),
        csvEscape(r.uom || '1 Kg'),
        csvEscape(r.dish_code || ''),
        csvEscape(rupeeCell(r.local_paise)),
        csvEscape(rupeeCell(r.blinkit_paise)),
        csvEscape(rupeeCell(r.instamart_paise)),
        csvEscape(rupeeCell(r.raithu_paise)),
        csvEscape(rupeeCell(r.cost_paise)),
        csvEscape(rupeeCell(r.suggested_acr_paise)),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

/** RFC4180-ish CSV parse (handles quotes, commas, CRLF). Skips # comment lines. */
export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.length > 1 || String(row[0] || '').trim() !== '') rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.length > 1 || String(row[0] || '').trim() !== '') rows.push(row);
  }
  return rows.filter((r) => !String(r[0] || '').trim().startsWith('#'));
}

function normHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[\s-]+/g, '_');
}

const HEADER_ALIASES = {
  item_key: ['item_key', 'key', 'sku_key'],
  item_name: ['item_name', 'name', 'item'],
  category: ['category', 'cat'],
  uom: ['uom', 'unit'],
  dish_code: ['dish_code', 'code', 'sku'],
  local_rupees: ['local_rupees', 'local', 'local_rs'],
  blinkit_rupees: ['blinkit_rupees', 'blinkit'],
  instamart_rupees: ['instamart_rupees', 'instamart'],
  raithu_rupees: ['raithu_rupees', 'raithu', 'raithu_market'],
  cost_rupees: ['cost_rupees', 'cost', 'buy_rupees'],
  acr_sell_rupees: [
    'acr_sell_rupees',
    'acr_sell',
    'sell_rupees',
    'sell',
    'suggested_acr_rupees',
    'price_rupees',
  ],
};

function mapHeaders(headerRow) {
  const idx = {};
  const headers = headerRow.map(normHeader);
  for (const [canon, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = headers.findIndex((h) => aliases.includes(h));
    if (i >= 0) idx[canon] = i;
  }
  return idx;
}

function cellAt(row, idx, key) {
  if (idx[key] == null) return '';
  return String(row[idx[key]] ?? '').trim();
}

function parseRupeesCell(raw, { allowEmpty = false } = {}) {
  const s = String(raw || '')
    .trim()
    .replace(/₹/g, '')
    .replace(/,/g, '');
  if (!s) return allowEmpty ? null : undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return rupeesToPaise(n);
}

/**
 * Parse uploaded CSV into price-board row patches (paise fields).
 * Empty price cells are skipped (keep existing). Requires item_key / dish_code / name.
 */
export function csvToPriceBoardPatches(text) {
  const table = parseCsvText(text);
  if (!table.length) throw new Error('Empty spreadsheet');
  const idx = mapHeaders(table[0]);
  if (idx.item_key == null && idx.dish_code == null && idx.item_name == null) {
    throw new Error(
      'Missing header row. Need item_key (or dish_code). Download the sheet first for the correct format.',
    );
  }
  const patches = [];
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row || !row.some((c) => String(c || '').trim())) continue;
    let item_key = normalizeItemKey(cellAt(row, idx, 'item_key'));
    const dish_code_raw = cellAt(row, idx, 'dish_code');
    const dish_code = dish_code_raw
      ? String(dish_code_raw).trim().toUpperCase().slice(0, 12)
      : null;
    const item_name = cellAt(row, idx, 'item_name');
    if (!item_key && dish_code) item_key = normalizeItemKey(dish_code.toLowerCase());
    if (!item_key && item_name) item_key = normalizeItemKey(item_name);
    if (!item_key) continue;

    const catRaw = cellAt(row, idx, 'category').toLowerCase();
    const category = catRaw.startsWith('fruit') ? 'fruits' : catRaw ? 'vegetables' : null;
    const uom = cellAt(row, idx, 'uom') || null;

    const money = (key) =>
      idx[key] != null ? parseRupeesCell(cellAt(row, idx, key)) : undefined;

    const patch = {
      item_key,
      item_name: item_name || null,
      category,
      uom,
      dish_code,
      local_paise: money('local_rupees'),
      blinkit_paise: money('blinkit_rupees'),
      instamart_paise: money('instamart_rupees'),
      raithu_paise: money('raithu_rupees'),
      cost_paise: money('cost_rupees'),
      suggested_acr_paise: money('acr_sell_rupees'),
      _row: r + 1,
    };
    patches.push(patch);
  }
  if (!patches.length) throw new Error('No data rows found under the header');
  return patches;
}

/**
 * Merge CSV patches onto existing board rows (match item_key, else dish_code).
 * Unknown keys become new rows when item_name is present.
 */
export function mergePriceBoardImport(existingRows, patches) {
  const rows = (existingRows || []).map((r) => ({ ...r }));
  const byKey = new Map(rows.map((r) => [String(r.item_key).toLowerCase(), r]));
  const byCode = new Map(
    rows
      .filter((r) => r.dish_code)
      .map((r) => [String(r.dish_code).toUpperCase(), r]),
  );
  let updated = 0;
  let created = 0;
  const errors = [];

  for (const p of patches) {
    let target = byKey.get(String(p.item_key).toLowerCase());
    if (!target && p.dish_code) target = byCode.get(String(p.dish_code).toUpperCase());

    if (!target) {
      if (!p.item_name) {
        errors.push(`Row ${p._row}: unknown item_key “${p.item_key}” (add item_name to create)`);
        continue;
      }
      const maxSort = rows.reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0);
      target = {
        item_key: p.item_key,
        item_name: p.item_name,
        category: p.category || 'vegetables',
        uom: p.uom || '1 Kg',
        dish_code: p.dish_code || null,
        sort_order: maxSort + 1,
        local_paise: null,
        blinkit_paise: null,
        instamart_paise: null,
        raithu_paise: null,
        cost_paise: null,
        suggested_acr_paise: null,
      };
      rows.push(target);
      byKey.set(target.item_key, target);
      if (target.dish_code) byCode.set(target.dish_code, target);
      created += 1;
    } else {
      updated += 1;
    }

    if (p.item_name) target.item_name = p.item_name;
    if (p.category) target.category = p.category;
    if (p.uom) target.uom = p.uom;
    if (p.dish_code) target.dish_code = p.dish_code;
    for (const f of [
      'local_paise',
      'blinkit_paise',
      'instamart_paise',
      'raithu_paise',
      'cost_paise',
      'suggested_acr_paise',
    ]) {
      if (p[f] !== undefined) target[f] = p[f];
    }
  }

  return { rows, updated, created, errors };
}
