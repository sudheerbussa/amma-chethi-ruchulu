/**
 * Admin API for the shared referral program (identical in order-bot and acr-fresh-bot).
 */
import {
  adminAdjustWallet,
  adminOverview,
  adminReferralsCsv,
  adminSetReferralStatus,
  adminWallet,
  saveReferralSettings,
} from '../referrals.js';
import { config } from '../config.js';

function fail(res, err, code = 400) {
  res.status(code).json({ ok: false, error: err?.message || String(err) });
}

export function mountReferralAdmin(app, auth) {
  app.get('/admin/api/referrals', auth, async (_req, res) => {
    try {
      res.json({ ok: true, ...(await adminOverview()) });
    } catch (err) {
      fail(res, err, 500);
    }
  });

  app.get('/admin/api/referrals/export.csv', auth, async (_req, res) => {
    try {
      const csv = await adminReferralsCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="acr-referrals.csv"');
      res.send(`\uFEFF${csv}`);
    } catch (err) {
      fail(res, err, 500);
    }
  });

  app.put('/admin/api/referrals/settings', auth, async (req, res) => {
    try {
      res.json({ ok: true, settings: await saveReferralSettings(req.body || {}) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/admin/api/referrals/:id/status', auth, async (req, res) => {
    try {
      const row = await adminSetReferralStatus(req.params.id, req.body?.status, req.body?.note);
      res.json({ ok: true, referral: row });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/admin/api/wallet/:phone', auth, async (req, res) => {
    try {
      res.json({ ok: true, ...(await adminWallet(req.params.phone)) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/admin/api/wallet/:phone/adjust', auth, async (req, res) => {
    try {
      const data = await adminAdjustWallet({
        phone: req.params.phone,
        delta_paise: req.body?.delta_paise,
        note: req.body?.note,
        by: `${config.adminHubProduct}-admin`,
      });
      res.json({ ok: true, ...data });
    } catch (err) {
      fail(res, err);
    }
  });
}
