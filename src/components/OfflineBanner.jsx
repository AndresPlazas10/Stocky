import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

const _motionLintUsage = motion;

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/75 text-white shadow-2xl"
          >
            <div className="p-6 sm:p-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <WifiOff className="h-7 w-7" />
              </div>

              <p className="text-base sm:text-lg font-semibold">
                Perdiste la conexión, intentando reconectar...
              </p>

              <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <motion.span
                    key={index}
                    className="h-2.5 w-2.5 rounded-full bg-white/90"
                    animate={{ y: [0, -6, 0], opacity: [0.45, 1, 0.45] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: index * 0.18
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
