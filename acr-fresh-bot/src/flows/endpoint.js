/**
 * Mount WhatsApp Flows data endpoint: POST /flows
 */

import { config } from '../config.js';
import { decryptFlowRequest, encryptFlowResponse } from './crypto.js';
import { handleFlowDataExchange } from './screens.js';

export function mountFlows(app) {
  app.get('/flows', (_req, res) => {
    res.status(200).json({
      ok: true,
      flows: Boolean(config.whatsappFlowId),
      endpoint: 'POST /flows',
      note: 'Meta Flow data channel — encrypted POST only',
    });
  });

  app.post('/flows', async (req, res) => {
    if (!config.whatsappFlowPrivateKey) {
      // Health check from Meta may still hit before keys are set
      if (req.body?.action === 'ping' || !req.body?.encrypted_aes_key) {
        res.status(200).send('active');
        return;
      }
      console.error('Flow POST but WHATSAPP_FLOW_PRIVATE_KEY is empty');
      res.sendStatus(503);
      return;
    }

    try {
      // Plain health check (some tooling)
      if (req.body?.action === 'ping' && !req.body?.encrypted_aes_key) {
        res.status(200).send('active');
        return;
      }

      console.log('Flow POST', {
        hasEncrypted: Boolean(req.body?.encrypted_aes_key),
        bodyKeys: Object.keys(req.body || {}),
      });

      const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptFlowRequest(
        req.body,
        config.whatsappFlowPrivateKey,
        config.whatsappFlowPassphrase,
      );

      console.log('Flow decrypted', {
        action: decryptedBody?.action,
        screen: decryptedBody?.screen || null,
        dataKeys: Object.keys(decryptedBody?.data || {}),
        error: decryptedBody?.data?.error || null,
        errorMessage: decryptedBody?.data?.error_message || null,
      });

      // Meta re-POSTs when our previous response failed schema validation
      if (decryptedBody?.data?.error) {
        console.error('Flow client rejected payload', {
          error: decryptedBody.data.error,
          error_message: decryptedBody.data.error_message,
          action: decryptedBody.action,
          screen: decryptedBody.screen,
        });
        const enc = encryptFlowResponse(
          { data: { acknowledged: true } },
          aesKeyBuffer,
          initialVectorBuffer,
        );
        res.status(200).type('text/plain').send(enc);
        return;
      }

      if (decryptedBody?.action === 'ping') {
        const enc = encryptFlowResponse(
          { data: { status: 'active' } },
          aesKeyBuffer,
          initialVectorBuffer,
        );
        res.status(200).type('text/plain').send(enc);
        return;
      }

      const screenData = await handleFlowDataExchange(decryptedBody);
      // Meta requires data_api version on every non-ping response
      const payload =
        screenData?.data?.status === 'active' && !screenData.screen
          ? screenData
          : {
              version: screenData.version || '3.0',
              ...screenData,
            };
      console.log('Flow reply', {
        action: decryptedBody?.action,
        screen: payload.screen || null,
        dataKeys: Object.keys(payload.data || {}),
        sample: JSON.stringify(payload.data || {}).slice(0, 400),
      });
      const enc = encryptFlowResponse(payload, aesKeyBuffer, initialVectorBuffer);
      res.status(200).type('text/plain').send(enc);
    } catch (err) {
      console.error('Flow endpoint error', err?.message || err, err?.stack || '');
      res.sendStatus(500);
    }
  });
}