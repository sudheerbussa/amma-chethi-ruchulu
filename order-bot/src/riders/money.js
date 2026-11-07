/** COD / prepaid helpers for rider + admin. */

export function orderCodDuePaise(order) {
  const due = Number(order?.cod_due_paise);
  if (Number.isFinite(due) && due > 0) return Math.round(due);
  return 0;
}

export function orderPrepaidPaise(order) {
  const total = Number(order?.total_paise) || 0;
  const due = orderCodDuePaise(order);
  const prepaid = Number(order?.prepaid_paise);
  if (Number.isFinite(prepaid) && prepaid >= 0) return Math.round(prepaid);
  return Math.max(0, total - due);
}

export function orderNeedsCashConfirm(order) {
  if (orderCodDuePaise(order) <= 0) return false;
  if (order?.cash_confirmed_at) return false;
  return true;
}

export function formatMoneyBrief(order) {
  const total = Number(order?.total_paise) || 0;
  const due = orderCodDuePaise(order);
  const prepaid = orderPrepaidPaise(order);
  const lines = [`Order total ₹${(total / 100).toFixed(0)}`];
  if (prepaid > 0) lines.push(`Already paid ₹${(prepaid / 100).toFixed(0)}`);
  if (due > 0) lines.push(`Collect cash (COD) ₹${(due / 100).toFixed(0)}`);
  else lines.push('No cash to collect (prepaid)');
  return lines.join('\n');
}
