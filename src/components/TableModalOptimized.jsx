import React, { useState } from 'react';
import { closeModalImmediate } from '../utils/closeModalImmediate';
import { isTableAvailable, isTableOccupied, normalizeTableStatus } from '../utils/tableStatus';

// Ejemplo de modal que cierra inmediatamente y hace la mutación en background
export default function TableModalOptimized({ table, tenantId, userId, isOpen, setIsOpen, updateLocalTable }) {
  const [busy, setBusy] = useState(false);

  const doServerAction = async (action) => {
    setBusy(true);
    try {
      // Fire-and-forget pattern: don't await to avoid blocking UI close
      const controller = new AbortController();
      fetch('/api/open-close-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: table.id, action, user_id: userId, business_id: tenantId }),
        signal: controller.signal
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok || body.error) throw new Error(body?.error || 'mutation failed');
          // Reconcile local state with server response
          updateLocalTable(table.id, { ...table, ...body.data });
        })
        .catch((err) => {
          // On error, revert or notify user
          // Optionally: refetch or rollback using snapshot stored elsewhere
        })
        .finally(() => setBusy(false));

      // Optional: timeout to abort if connection stalls (non-blocking)
      setTimeout(() => controller.abort(), 30_000);
    } catch (err) {
      setBusy(false);
    }
  };

  const handleCloseAndAction = (action) => {
    // Apply optimistic local change immediately
    const optimistic = {
      ...table,
      status: action === 'open' ? 'occupied' : 'available',
      updated_at: new Date().toISOString()
    };
    updateLocalTable(table.id, optimistic);

    // Close modal immediately and run server call in background
    closeModalImmediate(() => setIsOpen(false), () => doServerAction(action));

    // Note: preserve snapshot in higher-level store if rollback is needed on error
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ width: 480, background: 'white', borderRadius: 8, padding: 16 }}>
        <h3>Mesa {table.name}</h3>
        <p>Estado: {normalizeTableStatus(table.status)} {busy ? '· sincronizando…' : ''}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setIsOpen(false)}>Cancelar</button>
          <button disabled={busy || isTableOccupied(table.status)} onClick={() => handleCloseAndAction('open')}>Abrir</button>
          <button disabled={busy || isTableAvailable(table.status)} onClick={() => handleCloseAndAction('close')}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
