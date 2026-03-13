import { getSupabaseClient } from '../../lib/supabase';

type BusinessUpdatePayload = {
  name: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function isMissingColumnError(errorLike: any): boolean {
  const message = String(errorLike?.message || '').toLowerCase();
  const details = String(errorLike?.details || '').toLowerCase();
  return (
    message.includes('column')
    && (message.includes('does not exist') || details.includes('does not exist') || message.includes('schema cache'))
  );
}

function extractMissingColumnName(errorLike: any): string | null {
  const haystack = `${String(errorLike?.message || '')} ${String(errorLike?.details || '')}`;
  const match = haystack.match(/column\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
  if (!match?.[1]) return null;
  return String(match[1]).trim().toLowerCase();
}

export async function updateConfiguracionBusinessProfile({
  businessId,
  payload,
}: {
  businessId: string;
  payload: BusinessUpdatePayload;
}): Promise<void> {
  const normalizedBusinessId = normalizeText(businessId);
  if (!normalizedBusinessId) {
    throw new Error('No se encontro el negocio para actualizar.');
  }

  const normalizedName = normalizeText(payload?.name);
  if (!normalizedName) {
    throw new Error('El nombre del negocio es obligatorio.');
  }

  const data: Record<string, unknown> = {
    name: normalizedName,
    nit: normalizeNullable(payload?.nit),
    email: normalizeNullable(payload?.email),
    phone: normalizeNullable(payload?.phone),
    address: normalizeNullable(payload?.address),
  };

  const client = getSupabaseClient();
  let attempts = 0;
  let lastError: any = null;

  while (attempts < 5) {
    attempts += 1;
    const { error } = await client
      .from('businesses')
      .update(data)
      .eq('id', normalizedBusinessId);

    if (!error) return;
    lastError = error;

    if (!isMissingColumnError(error)) {
      throw new Error(error.message || 'No se pudo actualizar la informacion del negocio.');
    }

    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || !(missingColumn in data) || missingColumn === 'name') {
      break;
    }

    delete data[missingColumn];
  }

  const fallback = await client
    .from('businesses')
    .update({ name: normalizedName })
    .eq('id', normalizedBusinessId);

  if (fallback.error) {
    throw new Error(
      fallback.error.message
      || lastError?.message
      || 'No se pudo actualizar la informacion del negocio.',
    );
  }
}
