/* eslint-env node */
import { applyCors } from './_lib/apiUtils.js';
import { sendError, sendSuccess } from './_lib/apiUtils.js';

const WEB_PUSH_PUBLIC_KEY = String(process.env.WEB_PUSH_PUBLIC_KEY || process.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'OPTIONS,GET', headers: 'Content-Type' });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  if (!WEB_PUSH_PUBLIC_KEY) {
    sendError(res, 500, 'Web Push not configured');
    return;
  }

  sendSuccess(res, { publicKey: WEB_PUSH_PUBLIC_KEY });
}
