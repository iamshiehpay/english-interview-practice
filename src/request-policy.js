import {requireValue} from './domain.js';

export function localRequestPolicy(req) {
  requireValue(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ''), 'Local host required', 403);
  if (req.headers.origin) requireValue(req.headers.origin === `http://${req.headers.host}`, 'Cross-origin request rejected', 403);
}

export function publicSameOriginPolicy(req) {
  const host = req.headers.host || '';
  requireValue(/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host), 'Public host required', 403);
  const loopback = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
  const forwarded = String(req.headers['x-forwarded-proto'] || (loopback ? 'http' : 'https')).split(',')[0].trim();
  requireValue(['http', 'https'].includes(forwarded), 'Invalid forwarded protocol', 403);
  if (req.headers.origin) requireValue(req.headers.origin === `${forwarded}://${host}`, 'Cross-origin request rejected', 403);
}
