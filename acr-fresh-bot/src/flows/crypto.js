/**
 * WhatsApp Flows endpoint encryption (RSA-OAEP + AES-128-GCM).
 * @see https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/
 */

import crypto from 'node:crypto';

/**
 * @param {object} body Meta encrypted request body
 * @param {string} privatePem PKCS8/PKCS1 PEM private key
 * @param {string} [passphrase]
 */
export function decryptFlowRequest(body, privatePem, passphrase = '') {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body || {};
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new Error('Missing encrypted Flow fields');
  }

  const keyOpts = passphrase
    ? { key: privatePem, passphrase, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }
    : {
        key: crypto.createPrivateKey(privatePem),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      };

  const decryptedAesKey = crypto.privateDecrypt(
    keyOpts,
    Buffer.from(encrypted_aes_key, 'base64'),
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const initialVectorBuffer = Buffer.from(initial_vector, 'base64');
  const TAG_LENGTH = 16;
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encryptedTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, initialVectorBuffer);
  decipher.setAuthTag(encryptedTag);
  const decryptedJSONString = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]).toString('utf-8');

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

export function encryptFlowResponse(response, aesKeyBuffer, initialVectorBuffer) {
  const flippedIv = Buffer.alloc(initialVectorBuffer.length);
  for (let i = 0; i < initialVectorBuffer.length; i++) {
    flippedIv[i] = initialVectorBuffer[i] ^ 0xff;
  }
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flippedIv);
  return Buffer.concat([
    cipher.update(JSON.stringify(response), 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64');
}
