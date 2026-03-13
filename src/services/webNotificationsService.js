function isLocalhost() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').trim();
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveApiBaseUrl() {
  const raw = String(import.meta.env?.VITE_API_BASE_URL || '').trim();
  const normalized = raw.replace(/\/$/, '');
  if (isLocalhost()) return '';
  return normalized;
}

async function postNotify({ route, accessToken, body }) {
  const normalizedToken = String(accessToken || '').trim();
  if (!normalizedToken) {
    return { ok: false, status: null, message: 'Missing access token' };
  }

  const baseUrl = resolveApiBaseUrl();
  const url = `${baseUrl}${route}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
        'X-Stocky-Client': 'web',
      },
      body: JSON.stringify(body || {}),
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { error: raw || 'Unexpected response' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: String(payload?.error || payload?.message || `Request failed (${response.status})`),
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : String(error || 'Network error');
    return { ok: false, status: null, message: `${errorMessage} (url: ${url})` };
  }
}

export async function notifyAdminEmployeeLoginWeb({
  accessToken,
  businessId,
  employeeName,
}) {
  const normalizedBusinessId = String(businessId || '').trim();
  if (!normalizedBusinessId) {
    return { ok: false, status: null, message: 'Missing business id' };
  }

  const preferLegacy = isLocalhost();
  const firstRoute = preferLegacy ? '/api/notify-employee-login' : '/api/v2/notify-employee-login';
  const fallbackRoute = preferLegacy ? '/api/v2/notify-employee-login' : '/api/notify-employee-login';

  const primary = await postNotify({
    route: firstRoute,
    accessToken,
    body: {
      business_id: normalizedBusinessId,
      employee_name: employeeName || null,
    },
  });
  if (primary.ok) return primary;
  if (primary.status !== 404 && primary.status !== null) return primary;

  return postNotify({
    route: fallbackRoute,
    accessToken,
    body: {
      business_id: normalizedBusinessId,
      employee_name: employeeName || null,
    },
  });
}

export async function notifyAdminSaleRegisteredWeb({
  accessToken,
  businessId,
  saleTotal,
}) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedSaleTotal = Number(saleTotal);
  if (!normalizedBusinessId || !Number.isFinite(normalizedSaleTotal)) {
    return { ok: false, status: null, message: 'Missing business id or sale total' };
  }

  const preferLegacy = isLocalhost();
  const firstRoute = preferLegacy ? '/api/notify-sale-registered' : '/api/v2/notify-sale-registered';
  const fallbackRoute = preferLegacy ? '/api/v2/notify-sale-registered' : '/api/notify-sale-registered';

  const primary = await postNotify({
    route: firstRoute,
    accessToken,
    body: {
      business_id: normalizedBusinessId,
      sale_total: normalizedSaleTotal,
    },
  });
  if (primary.ok) return primary;
  if (primary.status !== 404 && primary.status !== null) return primary;

  return postNotify({
    route: fallbackRoute,
    accessToken,
    body: {
      business_id: normalizedBusinessId,
      sale_total: normalizedSaleTotal,
    },
  });
}
