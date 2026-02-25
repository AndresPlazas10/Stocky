/**
 * 🔌 Banner de alerta cuando no hay conexión a Internet
 * Se muestra en la parte superior de la aplicación
 */

import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useState, useEffect } from 'react';
import LOCAL_SYNC_CONFIG from '../config/localSync.js';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const canWriteOffline = Boolean(
    LOCAL_SYNC_CONFIG.enabled
    && (
      LOCAL_SYNC_CONFIG.localWrites?.allLocalFirst
      || LOCAL_SYNC_CONFIG.localWrites?.sales
      || LOCAL_SYNC_CONFIG.localWrites?.purchases
      || LOCAL_SYNC_CONFIG.localWrites?.orders
      || LOCAL_SYNC_CONFIG.localWrites?.tables
      || LOCAL_SYNC_CONFIG.localWrites?.products
      || LOCAL_SYNC_CONFIG.localWrites?.suppliers
      || LOCAL_SYNC_CONFIG.localWrites?.invoices
    )
  );

  useEffect(() => {
    if (!isOnline) {
      // Usuario se desconectó
      setShowBanner(true);
      setWasOffline(true);
    } else if (isOnline && wasOffline) {
      // Usuario se reconectó - mostrar mensaje breve
      setShowBanner(true);
      // Ocultar banner después de 3 segundos
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-1">
            {isOnline ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <div className="flex-1">
                  <p className="font-medium text-sm sm:text-base">
                    ✅ Conexión restablecida
                  </p>
                  <p className="text-xs sm:text-sm opacity-90">
                    Ya puedes continuar trabajando normalmente
                  </p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm sm:text-base">
                    ⚠️ Sin conexión a Internet
                  </p>
                  <p className="text-xs sm:text-sm opacity-90">
                    {canWriteOffline
                      ? 'Puedes seguir operando localmente. La sincronización se reanudará al reconectar.'
                      : 'No puedes crear registros ni sincronizar datos. Verifica tu conexión WiFi o datos móviles.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Indicador visual de estado */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                isOnline ? 'bg-green-200' : 'bg-red-200'
              }`}
            />
            <span className="text-xs font-mono hidden sm:inline">
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
