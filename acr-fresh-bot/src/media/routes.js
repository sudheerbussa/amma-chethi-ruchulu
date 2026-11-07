/**
 * Public media routes (no auth) — Catalog product image_url, dish storefront images.
 */

import fs from 'node:fs';
import { getCatalogDefaultPoster } from '../posters.js';
import { findDishImageFile, mimeForDishFile } from '../dish-images.js';

export function mountPublicMedia(app) {
  /**
   * Default product image for WhatsApp Catalog sync.
   * Serves the uploaded full_menu (or fallback) poster as a stable HTTPS URL.
   */
  app.get('/media/catalog-default', (_req, res) => {
    const poster = getCatalogDefaultPoster();
    if (!poster?.file || !fs.existsSync(poster.file)) {
      res.status(404).json({
        error: 'No poster uploaded',
        hint: 'Add assets/catalog-default.jpg or upload Full menu #1 in Admin → Posters, then retry Catalog sync',
      });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.sendFile(poster.file, {
      headers: { 'Content-Type': poster.mime || 'image/jpeg' },
    });
  });

  /** Per-item storefront photo. */
  app.get('/media/dish/:code', (req, res) => {
    const found = findDishImageFile(req.params.code);
    if (!found?.file || !fs.existsSync(found.file)) {
      res.status(404).json({ error: 'No image for this item' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.sendFile(found.file, {
      headers: { 'Content-Type': mimeForDishFile(found.file) },
    });
  });
}
