import { EXPO_CONFIG } from '../config/env';

export type ApiCheckResult = {
  name: string;
  status: number | null;
  apiVersion: string | null;
  fallback: string | null;
  ok: boolean;
  body: string;
};

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Stocky-Client': 'mobile',
  'X-Stocky-Client-Version': EXPO_CONFIG.clientVersion,
};

async function post(route: string) {
  const response = await fetch(`${EXPO_CONFIG.apiBaseUrl}${route}`, {
    method: 'POST',
    headers: commonHeaders,
    body: JSON.stringify({}),
  });

  const body = await response.text();

  return {
    status: response.status,
    apiVersion: response.headers.get('x-stocky-api-version'),
    fallback: response.headers.get('x-stocky-api-fallback'),
    body,
  };
}

export async function runApiSmokeChecks(): Promise<ApiCheckResult[]> {
  const checks: Array<{ name: string; route: string; expectedVersion: 'v1' | 'v2' }> = [
    {
      name: 'v2 open-close-table (mobile)',
      route: '/api/v2/open-close-table',
      expectedVersion: 'v2',
    },
    {
      name: 'v2 send-email (mobile)',
      route: '/api/v2/send-email',
      expectedVersion: 'v1',
    },
  ];

  const results: ApiCheckResult[] = [];
  for (const check of checks) {
    try {
      const response = await post(check.route);
      results.push({
        name: check.name,
        ...response,
        ok: response.status === 401 && response.apiVersion === check.expectedVersion,
      });
    } catch (error) {
      results.push({
        name: check.name,
        status: null,
        apiVersion: null,
        fallback: null,
        body: error instanceof Error ? error.message : 'Network error',
        ok: false,
      });
    }
  }

  return results;
}
