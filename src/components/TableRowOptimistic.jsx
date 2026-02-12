import React, { useState } from 'react';

// Componente de ejemplo que aplica actualización optimista para abrir/cerrar mesa
// `updateLocalTable` debe venir del estado global (Context, Zustand, Redux, react-query mutate, etc.)
export default function TableRowOptimistic({ table, tenantId, userId, updateLocalTable }) {
  const [saving, setSaving] = useState(false);

  const mutateServer = async (action) => {
    const resp = await fetch('/api/open-close-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: table.id, action, user_id: userId, tenant_id: tenantId })
    });
    return resp.json();
  };

  const openOrClose = async (action) => {
    const snapshot = { ...table };
    const optimistic = { ...table, status: action === 'open' ? 'open' : 'closed', updated_at: new Date().toISOString() };

    // Aplicar cambio optimista inmediatamente
    updateLocalTable(table.id, optimistic);
    setSaving(true);

    try {
      const body = await mutateServer(action);
      if (!body || body.error) throw new Error(body?.error || 'Server error');

      // Reconciliar con la respuesta del servidor (si devuelve timestamps/version)
      updateLocalTable(table.id, { ...optimistic, ...body.data });
      setSaving(false);
    } catch (err) {
      // Revertir en caso de error
      updateLocalTable(table.id, snapshot);
      setSaving(false);
      console.error('open/close failed:', err);
      // Opcional: notificar al usuario con toast
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, borderBottom: '1px solid #eee' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{table.name || `Mesa ${table.id}`}</div>
        <div style={{ color: '#666', fontSize: 12 }}>{table.status} {saving ? ' · sincronizando…' : ''}</div>
      </div>
      <div>
        <button disabled={saving || table.status === 'open'} onClick={() => openOrClose('open')} style={{ marginRight: 6 }}>Abrir</button>
        <button disabled={saving || table.status === 'closed'} onClick={() => openOrClose('close')}>Cerrar</button>
      </div>
    </div>
  );
}
