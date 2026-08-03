import { config } from './config.js';

/** Current time in Asia/Kolkata */
export function nowIst() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dateLabel: `${get('day')}/${get('month')}/${get('year')}`,
  };
}

function cutoffLabel(hour) {
  const h = Number(hour);
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${String(h).padStart(2, '0')}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${String(h - 12).padStart(2, '0')}:00 PM`;
}

export function isLunchOpen() {
  if (config.bypassCutoffs) return true;
  return nowIst().hour < config.lunchCutoffHour;
}

export function isDinnerOpen() {
  if (config.bypassCutoffs) return true;
  return nowIst().hour < config.dinnerCutoffHour;
}

export function mealStatusText() {
  const lunch = isLunchOpen()
    ? `OPEN (order by ${cutoffLabel(config.lunchCutoffHour)}; serve ~12–3 PM)`
    : 'CLOSED for today';
  const dinner = isDinnerOpen()
    ? `OPEN (order by ${cutoffLabel(config.dinnerCutoffHour)}; serve ~7–10 PM)`
    : 'CLOSED for today';
  return `Lunch: ${lunch}\nDinner: ${dinner}`;
}
