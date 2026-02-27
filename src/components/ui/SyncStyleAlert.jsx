import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export const ALERT_AUTO_CLOSE_MS = 1000;
const _motionLintUsage = motion;

const TONE_CONFIG = {
  success: {
    icon: null,
    overlayClass: 'bg-slate-950/34',
    cardClass: 'border-white/14 bg-slate-950/52',
    accentClass: 'text-slate-100',
    lineClass: 'bg-white/70'
  },
  error: {
    icon: AlertCircle,
    overlayClass: 'bg-slate-950/34',
    cardClass: 'border-white/14 bg-slate-950/52',
    accentClass: 'text-slate-100',
    lineClass: 'bg-white/70'
  },
  warning: {
    icon: AlertTriangle,
    overlayClass: 'bg-slate-950/34',
    cardClass: 'border-white/14 bg-slate-950/52',
    accentClass: 'text-slate-100',
    lineClass: 'bg-white/70'
  },
  info: {
    icon: Info,
    overlayClass: 'bg-slate-950/34',
    cardClass: 'border-white/14 bg-slate-950/52',
    accentClass: 'text-slate-100',
    lineClass: 'bg-white/70'
  }
};

function normalizeDetails(details) {
  if (!Array.isArray(details)) return [];
  return details
    .filter(Boolean)
    .map((detail) => ({
      label: String(detail?.label || '').trim(),
      value: String(detail?.value || '').trim()
    }))
    .filter((detail) => detail.label || detail.value)
    .slice(0, 3);
}

function AnimatedStatusGlyph({ type, Icon, accentClass }) {
  if (type === 'success') {
    return (
      <motion.div
        initial={{ scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.86, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`relative h-16 w-16 ${accentClass}`}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0.35 }}
          animate={{ scale: 1.08, opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2 border-current"
        />
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.12, duration: 0.34, ease: 'easeOut' }}
          className="flex h-full w-full items-center justify-center rounded-full border-2 border-current"
        >
          <CheckCircle2 className="h-9 w-9" />
        </motion.div>
      </motion.div>
    );
  }

  const SafeIcon = Icon || Info;
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: [0, -2, 0] }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] ${accentClass}`}
    >
      <SafeIcon className="h-7 w-7" />
    </motion.div>
  );
}

export function SyncStyleAlert({
  isVisible,
  onClose,
  type = 'info',
  title = '',
  message = '',
  details = [],
  icon: IconOverride = null,
  usePortal = true,
  autoClose = true,
  className = ''
}) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!autoClose || !isVisible || typeof onClose !== 'function') return undefined;

    const timer = window.setTimeout(() => {
      onClose();
    }, ALERT_AUTO_CLOSE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoClose, isVisible, onClose]);

  if (!isMounted) return null;

  const tone = TONE_CONFIG[type] || TONE_CONFIG.info;
  const Icon = IconOverride || tone.icon || Info;
  const normalizedDetails = normalizeDetails(details);
  const normalizedTitle = String(title || '').trim();
  const normalizedMessage = String(message || '').trim();

  const alertNode = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className={`fixed inset-0 z-[2147483647] ${tone.overlayClass} p-4 backdrop-blur-sm ${className}`}
        >
          <div className="flex min-h-full items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_10px_35px_-24px_rgba(0,0,0,0.65)] ${tone.cardClass}`}
              role="alertdialog"
              aria-live="assertive"
              aria-busy="true"
              aria-modal="true"
            >
              <div className="relative overflow-hidden p-6 sm:p-7">
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/8 blur-2xl"
                  animate={{ x: [0, 8, 0], y: [0, 6, 0] }}
                  transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                />
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 bottom-2 h-20 w-20 rounded-full bg-white/6 blur-2xl"
                  animate={{ x: [0, -6, 0], y: [0, -5, 0] }}
                  transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                />
                <div className="flex flex-col items-center text-center">
                  <AnimatedStatusGlyph
                    type={type}
                    Icon={Icon}
                    accentClass={tone.accentClass}
                  />

                  {normalizedTitle && (
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-100">
                      {normalizedTitle}
                    </h3>
                  )}

                  {normalizedMessage && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {normalizedMessage}
                    </p>
                  )}
                </div>

                {normalizedDetails.length > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    {normalizedDetails.map((detail) => (
                      <div key={`${detail.label}:${detail.value}`} className="flex items-start justify-between gap-3 text-xs sm:text-sm">
                        <span className="text-slate-400">{detail.label}</span>
                        <span className="max-w-[62%] truncate text-right font-medium text-slate-200">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 h-0.5 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: ALERT_AUTO_CLOSE_MS / 1000, ease: 'linear' }}
                    className={`h-full w-full origin-left ${tone.lineClass}`}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (usePortal) {
    if (typeof document === 'undefined') return null;
    return createPortal(alertNode, document.body);
  }

  return alertNode;
}

export default SyncStyleAlert;
