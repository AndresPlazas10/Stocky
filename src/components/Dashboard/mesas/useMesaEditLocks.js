import { useState, useCallback, useEffect } from 'react';
import {
  normalizeEntityId,
  normalizeDisplayName,
  isMesaLockExpired,
  isDuplicateKeyError,
  isMissingTableEditLocksRelationError,
  isMissingTableEditLocksColumnError,
  MESA_LOCK_TTL_SECONDS,
} from './mesaHelpers.js';
import { supabase } from '../../../supabase/Client';

export function useMesaEditLocks({
  businessId,
  currentUser,
  isOfflineFirstRuntime,
  heldMesaLockRef,
  mesaSyncClientIdRef,
  _activeMesaBroadcastRef,
  mesaLockHeartbeatTimerRef,
}) {
  const [mesaLocksByTableId, setMesaLocksByTableId] = useState({});

  const resolveWebUserId = useCallback(
    () => normalizeEntityId(currentUser?.id),
    [currentUser?.id],
  );

  const resolveWebUserName = useCallback(
    () => normalizeDisplayName(currentUser?.email || currentUser?.name || 'Admin', 'Admin'),
    [currentUser?.email, currentUser?.name],
  );

  useEffect(() => {
    return () => {
      if (mesaLockHeartbeatTimerRef.current) {
        clearInterval(mesaLockHeartbeatTimerRef.current);
        mesaLockHeartbeatTimerRef.current = null;
      }
    };
  }, []);

  const normalizeMesaLockRow = useCallback((row) => {
    if (!row || typeof row !== 'object') return null;
    const tableId = String(row?.table_id || '').trim();
    if (!tableId) return null;
    const normalizedBusinessId = String(row?.business_id || '').trim();
    const lockOwnerName = normalizeDisplayName(row?.lock_owner_name || 'Alguien', 'Alguien');
    const normalized = {
      ...row,
      table_id: tableId,
      business_id: normalizedBusinessId,
      lock_owner_user_id: String(row?.lock_owner_user_id || '').trim(),
      lock_owner_name: lockOwnerName,
      lock_token: row?.lock_token ? String(row.lock_token).trim() : null,
      lock_expires_at: row?.lock_expires_at || null,
      updated_at: row?.updated_at || new Date().toISOString(),
    };
    return normalized;
  }, []);

  const applyMesaLocks = useCallback(
    (locks = []) => {
      const next = {};
      const nowMs = Date.now();
      (Array.isArray(locks) ? locks : []).forEach((lock) => {
        const normalized = normalizeMesaLockRow(lock);
        if (!normalized?.table_id) return;
        const expiresAtMs = Date.parse(String(normalized.lock_expires_at || '').trim());
        if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) return;
        next[normalized.table_id] = normalized;
      });
      setMesaLocksByTableId(next);
    },
    [normalizeMesaLockRow],
  );

  const refreshMesaLocks = useCallback(
    async (targetBusinessId) => {
      const normalizedBusinessId = String(targetBusinessId || '').trim();
      if (!normalizedBusinessId) {
        setMesaLocksByTableId({});
        return;
      }

      const baseSelect =
        'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at';
      const fallbackSelect =
        'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at';

      let result = await supabase
        .from('table_edit_locks')
        .select(baseSelect)
        .eq('business_id', normalizedBusinessId);

      if (result.error) {
        if (isMissingTableEditLocksRelationError(result.error)) {
          setMesaLocksByTableId({});
          return;
        }
        if (isMissingTableEditLocksColumnError(result.error, 'lock_token')) {
          result = await supabase
            .from('table_edit_locks')
            .select(fallbackSelect)
            .eq('business_id', normalizedBusinessId);
        } else {
          return;
        }
      }

      if (result?.error) return;
      applyMesaLocks(result?.data || []);
    },
    [applyMesaLocks],
  );

  const applyRealtimeMesaLockRow = useCallback(
    (row, eventType = 'UPDATE') => {
      const normalized = normalizeMesaLockRow(row);
      const tableId = normalized?.table_id;
      if (!tableId) return;

      if (eventType === 'DELETE' || isMesaLockExpired(normalized)) {
        setMesaLocksByTableId((prev) => {
          if (!prev[tableId]) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
        return;
      }

      setMesaLocksByTableId((prev) => ({
        ...prev,
        [tableId]: normalized,
      }));
    },
    [normalizeMesaLockRow],
  );

  const applyRealtimeMesaLockBroadcast = useCallback(
    (payload) => {
      const senderClientId = String(payload?.sender_client_id || '').trim();
      if (senderClientId && senderClientId === String(mesaSyncClientIdRef.current || '').trim())
        return;

      const normalizedBusinessId = String(businessId || '').trim();
      const payloadBusinessId = String(payload?.business_id || '').trim();
      if (normalizedBusinessId && (!payloadBusinessId || payloadBusinessId !== normalizedBusinessId)) {
        return;
      }

      const mesaId = String(payload?.mesa_id || '').trim();
      if (!mesaId) return;

      const locked =
        payload?.locked === true ||
        String(payload?.locked || '').trim().toLowerCase() === 'true';

      if (!locked) {
        setMesaLocksByTableId((prev) => {
          if (!prev[mesaId]) return prev;
          const next = { ...prev };
          delete next[mesaId];
          return next;
        });
        return;
      }

      const ownerUserId = String(
        payload?.lock_owner_user_id || payload?.sender_user_id || '',
      ).trim();
      if (!ownerUserId) return;

      const resolvedBusinessId = normalizedBusinessId || String(payload?.business_id || '').trim();
      const lockToken = String(payload?.lock_token || '').trim() || null;
      const rawExpiresAt = String(payload?.lock_expires_at || '').trim();
      const lockTtlMs = Math.min(
        120_000,
        Math.max(15_000, Number(payload?.lock_ttl_ms || 45_000)),
      );
      const nowMs = Date.now();
      const parsedExpiresAt = rawExpiresAt ? Date.parse(rawExpiresAt) : Number.NaN;
      const safeExpiresAtMs = Number.isFinite(parsedExpiresAt)
        ? Math.min(parsedExpiresAt, nowMs + lockTtlMs)
        : nowMs + lockTtlMs;
      const lockExpiresAt = new Date(safeExpiresAtMs).toISOString();

      setMesaLocksByTableId((prev) => ({
        ...prev,
        [mesaId]: {
          table_id: mesaId,
          business_id: resolvedBusinessId || String(prev[mesaId]?.business_id || '').trim(),
          lock_owner_user_id: ownerUserId,
          lock_owner_name: 'Alguien',
          lock_token: lockToken,
          lock_expires_at: lockExpiresAt,
          updated_at: new Date().toISOString(),
        },
      }));
    },
    [businessId],
  );

  const getMesaLockState = useCallback(
    (mesaId) => {
      if (isOfflineFirstRuntime) {
        return { lockedByOther: false, lockOwnerName: null };
      }

      const normalizedMesaId = String(mesaId || '').trim();
      if (!normalizedMesaId) return { lockedByOther: false, lockOwnerName: null };
      const mesaLock = mesaLocksByTableId[normalizedMesaId];
      if (!mesaLock || isMesaLockExpired(mesaLock)) {
        return { lockedByOther: false, lockOwnerName: null };
      }

      const lockOwnerId = String(mesaLock?.lock_owner_user_id || '').trim();
      const lockToken = String(mesaLock?.lock_token || '').trim();
      const resolvedUserId = resolveWebUserId();
      const heldLock = heldMesaLockRef.current;
      const isLocalHeldLock = Boolean(
        heldLock &&
          String(heldLock.tableId || '').trim() === normalizedMesaId &&
          String(heldLock.businessId || '').trim() === String(businessId || '').trim(),
      );
      const heldLockToken = isLocalHeldLock ? String(heldLock?.lockToken || '').trim() : '';
      const isOwnedByCurrentUser = Boolean(lockOwnerId && lockOwnerId === resolvedUserId);
      const isSameClientLock = Boolean(lockToken && heldLockToken && lockToken === heldLockToken);
      const lockedByOther = Boolean(
        lockOwnerId
          ? !isOwnedByCurrentUser
          : lockToken
            ? !isSameClientLock
            : true,
      );

      return {
        lockedByOther,
        lockOwnerName: normalizeDisplayName(mesaLock?.lock_owner_name || 'Alguien', 'Alguien'),
      };
    },
    [businessId, isOfflineFirstRuntime, mesaLocksByTableId, resolveWebUserId],
  );

  const selectMesaEditLockByTableId = useCallback(
    async ({ businessId: targetBusinessId, tableId }) => {
      const normalizedBusinessId = String(targetBusinessId || '').trim();
      const normalizedTableId = String(tableId || '').trim();
      if (!normalizedBusinessId || !normalizedTableId) return null;

      const result = await supabase
        .from('table_edit_locks')
        .select(
          'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at',
        )
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .maybeSingle();

      if (result.error) {
        if (isMissingTableEditLocksRelationError(result.error)) return null;
        if (isMissingTableEditLocksColumnError(result.error, 'lock_token')) {
          const fallback = await supabase
            .from('table_edit_locks')
            .select(
              'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at',
            )
            .eq('business_id', normalizedBusinessId)
            .eq('table_id', normalizedTableId)
            .maybeSingle();
          if (fallback.error) return null;
          return fallback.data || null;
        }
        return null;
      }

      return result.data || null;
    },
    [],
  );

  const acquireMesaEditLockWeb = useCallback(
    async ({ targetBusinessId, tableId, lockToken }) => {
      const normalizedBusinessId = String(targetBusinessId || '').trim();
      const normalizedTableId = String(tableId || '').trim();
      const resolvedUserId = resolveWebUserId();
      const resolvedUserName = resolveWebUserName();
      if (!normalizedBusinessId || !normalizedTableId || !resolvedUserId) {
        return { ok: false, unsupported: false, lock: null, lockToken: null };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const lockExpiresAt = new Date(now.getTime() + MESA_LOCK_TTL_SECONDS * 1000).toISOString();
      const normalizedLockToken = String(lockToken || '').trim() || null;

      const cleanupExpired = await supabase
        .from('table_edit_locks')
        .delete()
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .lte('lock_expires_at', nowIso);

      if (cleanupExpired.error) {
        if (isMissingTableEditLocksRelationError(cleanupExpired.error)) {
          return { ok: true, unsupported: true, lock: null, lockToken: null };
        }
        if (!isMissingTableEditLocksColumnError(cleanupExpired.error, 'lock_expires_at')) {
          return { ok: false, unsupported: false, lock: null, lockToken: null };
        }
      }

      const payloadWithToken = {
        business_id: normalizedBusinessId,
        table_id: normalizedTableId,
        lock_owner_user_id: resolvedUserId,
        lock_owner_name: resolvedUserName,
        lock_token: normalizedLockToken,
        lock_expires_at: lockExpiresAt,
        updated_at: nowIso,
      };

      const payloadNoToken = {
        business_id: normalizedBusinessId,
        table_id: normalizedTableId,
        lock_owner_user_id: resolvedUserId,
        lock_owner_name: resolvedUserName,
        lock_expires_at: lockExpiresAt,
        updated_at: nowIso,
      };

      const insertWithToken = await supabase
        .from('table_edit_locks')
        .insert([payloadWithToken])
        .select(
          'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at',
        )
        .maybeSingle();

      if (!insertWithToken.error && insertWithToken.data) {
        return {
          ok: true,
          unsupported: false,
          lock: insertWithToken.data,
          lockToken: normalizedLockToken,
        };
      }

      if (insertWithToken.error) {
        if (isMissingTableEditLocksRelationError(insertWithToken.error)) {
          return { ok: true, unsupported: true, lock: null, lockToken: null };
        }
        if (isMissingTableEditLocksColumnError(insertWithToken.error, 'lock_token')) {
          const fallbackInsert = await supabase
            .from('table_edit_locks')
            .insert([payloadNoToken])
            .select(
              'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at',
            )
            .maybeSingle();
          if (!fallbackInsert.error && fallbackInsert.data) {
            return { ok: true, unsupported: false, lock: fallbackInsert.data, lockToken: null };
          }
        } else if (!isDuplicateKeyError(insertWithToken.error)) {
          return { ok: false, unsupported: false, lock: null, lockToken: null };
        }
      }

      const existing = await selectMesaEditLockByTableId({
        businessId: normalizedBusinessId,
        tableId: normalizedTableId,
      });

      if (
        existing &&
        String(existing.lock_owner_user_id || '').trim() !== resolvedUserId
      ) {
        return { ok: false, unsupported: false, lock: existing, lockToken: null };
      }

      const updatePayload = normalizedLockToken ? payloadWithToken : payloadNoToken;
      const updateAttempt = await supabase
        .from('table_edit_locks')
        .update(updatePayload)
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .eq('lock_owner_user_id', resolvedUserId)
        .select(
          'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at',
        )
        .maybeSingle();

      if (!updateAttempt.error && updateAttempt.data) {
        return {
          ok: true,
          unsupported: false,
          lock: updateAttempt.data,
          lockToken: normalizedLockToken,
        };
      }

      return { ok: false, unsupported: false, lock: existing || null, lockToken: null };
    },
    [resolveWebUserId, resolveWebUserName, selectMesaEditLockByTableId],
  );

  const refreshMesaEditLockHeartbeatWeb = useCallback(
    async ({ targetBusinessId, tableId, lockToken }) => {
      const normalizedBusinessId = String(targetBusinessId || '').trim();
      const normalizedTableId = String(tableId || '').trim();
      const resolvedUserId = resolveWebUserId();
      const resolvedUserName = resolveWebUserName();
      if (!normalizedBusinessId || !normalizedTableId || !resolvedUserId) {
        return { ok: false, unsupported: false, lock: null, lost: true };
      }

      const now = new Date();
      const payload = {
        lock_owner_name: resolvedUserName,
        lock_expires_at: new Date(now.getTime() + MESA_LOCK_TTL_SECONDS * 1000).toISOString(),
        updated_at: now.toISOString(),
        ...(lockToken ? { lock_token: String(lockToken || '').trim() } : {}),
      };

      let query = supabase
        .from('table_edit_locks')
        .update(payload)
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .eq('lock_owner_user_id', resolvedUserId);

      if (lockToken) {
        query = query.eq('lock_token', String(lockToken || '').trim());
      }

      const updateAttempt = await query
        .select(
          'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_token,lock_expires_at,updated_at',
        )
        .maybeSingle();

      if (!updateAttempt.error && updateAttempt.data) {
        return { ok: true, unsupported: false, lock: updateAttempt.data, lost: false };
      }

      if (updateAttempt.error && isMissingTableEditLocksRelationError(updateAttempt.error)) {
        return { ok: true, unsupported: true, lock: null, lost: false };
      }

      if (
        updateAttempt.error &&
        isMissingTableEditLocksColumnError(updateAttempt.error, 'lock_token')
      ) {
        const fallback = await supabase
          .from('table_edit_locks')
          .update({
            lock_owner_name: resolvedUserName,
            lock_expires_at: payload.lock_expires_at,
            updated_at: payload.updated_at,
          })
          .eq('business_id', normalizedBusinessId)
          .eq('table_id', normalizedTableId)
          .eq('lock_owner_user_id', resolvedUserId)
          .select(
            'table_id,business_id,lock_owner_user_id,lock_owner_name,lock_expires_at,updated_at',
          )
          .maybeSingle();
        if (!fallback.error && fallback.data) {
          return { ok: true, unsupported: false, lock: fallback.data, lost: false };
        }
      }

      const existing = await selectMesaEditLockByTableId({
        businessId: normalizedBusinessId,
        tableId: normalizedTableId,
      });

      if (
        existing &&
        String(existing.lock_owner_user_id || '').trim() !== resolvedUserId
      ) {
        return { ok: false, unsupported: false, lock: existing, lost: true };
      }

      return { ok: false, unsupported: false, lock: existing || null, lost: true };
    },
    [resolveWebUserId, resolveWebUserName, selectMesaEditLockByTableId],
  );

  const releaseMesaEditLockWeb = useCallback(
    async ({ targetBusinessId, tableId, lockToken }) => {
      const normalizedBusinessId = String(targetBusinessId || '').trim();
      const normalizedTableId = String(tableId || '').trim();
      const resolvedUserId = resolveWebUserId();
      if (!normalizedBusinessId || !normalizedTableId || !resolvedUserId) return;

      let query = supabase
        .from('table_edit_locks')
        .delete()
        .eq('business_id', normalizedBusinessId)
        .eq('table_id', normalizedTableId)
        .eq('lock_owner_user_id', resolvedUserId);

      if (lockToken) {
        query = query.eq('lock_token', String(lockToken || '').trim());
      }

      const result = await query;
      if (!result.error) return;
      if (isMissingTableEditLocksRelationError(result.error)) return;
      if (isMissingTableEditLocksColumnError(result.error, 'lock_token')) {
        await supabase
          .from('table_edit_locks')
          .delete()
          .eq('business_id', normalizedBusinessId)
          .eq('table_id', normalizedTableId)
          .eq('lock_owner_user_id', resolvedUserId);
      }
    },
    [resolveWebUserId],
  );

  return {
    mesaLocksByTableId,
    getMesaLockState,
    acquireMesaEditLockWeb,
    refreshMesaEditLockHeartbeatWeb,
    releaseMesaEditLockWeb,
    normalizeMesaLockRow,
    applyMesaLocks,
    refreshMesaLocks,
    applyRealtimeMesaLockRow,
    applyRealtimeMesaLockBroadcast,
    selectMesaEditLockByTableId,
  };
}
