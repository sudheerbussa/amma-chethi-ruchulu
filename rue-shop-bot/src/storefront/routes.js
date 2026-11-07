import { resolveFromRoot } from '../paths.js';
import { config } from '../config.js';
import { activeProducts, CATEGORIES, formatInr, MENU_VERSION } from '../menu.js';
import { shippingOptionsPublic, computeShipping } from '../shipping.js';
import { createManualOrder } from '../orders/create-manual.js';
import { isRazorpayReady } from '../razorpay.js';

const SHOP_PAGE = resolveFromRoot('public/shop/index.html');

export function mountStorefront(app) {
  app.get(['/shop', '/shop/'], (_req, res) => {
    res.sendFile(SHOP_PAGE);
  });

  app.get('/api/storefront/menu', (_req, res) => {
    const products = activeProducts().map((p) => ({
      code: p.code,
      name: p.name,
      product_type: p.product_type,
      category: p.category,
      price_paise: p.price_paise,
      price_label: formatInr(p.price_paise),
      specs: p.specs || {},
      image: p.image,
    }));
    res.json({
      business_name: config.businessName,
      menu_version: MENU_VERSION,
      categories: CATEGORIES,
      products,
      shipping: shippingOptionsPublic(),
      razorpay: isRazorpayReady(),
      support_phone: config.supportPhone,
      shop_address: config.shopAddress,
    });
  });

  app.post('/api/storefront/quote-shipping', (req, res) => {
    const mode = req.body?.mode || req.body?.fulfillment;
    const town = req.body?.town || req.body?.city;
    const subtotalPaise = Number(req.body?.subtotal_paise || req.body?.subtotalPaise || 0);
    const result = computeShipping({ mode, town, subtotalPaise });
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  app.post('/api/storefront/checkout', async (req, res) => {
    try {
      const result = await createManualOrder({
        ...(req.body || {}),
        created_via: 'web_storefront',
      });
      if (!result.ok) {
        res.status(400).json(result);
        return;
      }
      if (!result.pay_url) {
        res.status(503).json({
          ok: false,
          error: 'Payment page URL not configured (PUBLIC_BASE_URL)',
          order_ref: result.order_ref,
        });
        return;
      }
      if (!isRazorpayReady()) {
        res.status(503).json({
          ok: false,
          error: 'Online payment is not configured yet. Please WhatsApp us with your order id.',
          order_ref: result.order_ref,
        });
        return;
      }
      res.json({
        ok: true,
        order_ref: result.order_ref,
        pay_url: result.pay_url,
        total_paise: result.total_paise,
        total_label: formatInr(result.total_paise),
      });
    } catch (err) {
      console.error('[storefront] checkout', err);
      res.status(500).json({ ok: false, error: err.message || 'Checkout failed' });
    }
  });
}
