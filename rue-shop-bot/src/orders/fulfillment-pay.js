/** Prepaid-only shop: online pay while pending_payment. */

export function orderAcceptsOnlinePayment(order) {
  return order && order.status === 'pending_payment';
}

export function onlinePaymentAmountPaise(order) {
  return Math.max(0, Math.round(Number(order?.total_paise) || 0));
}

export function orderHasOpenCod() {
  return false;
}
