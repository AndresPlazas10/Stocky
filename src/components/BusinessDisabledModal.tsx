import { motion } from 'framer-motion';
import { Lock, Tag, CreditCard, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

type BusinessDisabledModalProps = {
  businessName?: string;
  onSignOut?: () => void;
};

const WOMPI_URL = 'https://checkout.wompi.co/l/66X542';

function BusinessDisabledModal({
  businessName = 'su negocio',
  onSignOut,
}: BusinessDisabledModalProps) {
  const { t } = useTranslation('common');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 backdrop-blur-md flex items-center justify-center z-[99999] p-4 lg:p-8 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent-300/15 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-primary-300/10 blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-accent-200/10 blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col"
      >
        <div className="bg-gradient-to-br from-red-700 to-red-900 px-8 py-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full -ml-18 -mb-18" />

          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center mb-3">
              <div className="p-3.5 bg-white/20 rounded-full backdrop-blur-sm">
                <Lock className="w-9 h-9" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-1.5">
              {t('businessDisabled.accessBlocked')}
            </h1>
            <p className="text-white/80 text-base">
              {businessName}
            </p>
          </div>
        </div>

        <div className="p-7 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <Tag className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-emerald-900 text-base mb-1.5">
                        {t('businessDisabled.economicalTitle')}
                      </h3>
                      <p className="text-emerald-800 text-sm leading-relaxed">
                        {t('businessDisabled.economicalDesc')}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">
                          {t('businessDisabled.monthlyFixed')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-5">
                  <div className="flex items-start gap-3.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-base mb-1.5">
                        {t('businessDisabled.importantTitle')}
                      </h3>
                      <p className="text-amber-800 text-sm leading-relaxed">
                        {t('businessDisabled.paymentInstructions')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {t('businessDisabled.reactivationNote')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-lg">
                    <img
                      src="/branding/banks/qrWompi.png"
                      alt="QR Wompi"
                      className="w-60 h-60 rounded-xl"
                    />
                  </div>
                  <p className="text-sm text-gray-500 font-medium text-center">
                    {t('businessDisabled.scanOrClick')}
                  </p>
                </div>

                <a
                  href={WOMPI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full max-w-xs"
                >
                  <Button
                    className="cursor-pointer w-full h-13 text-base font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200"
                  >
                    <ExternalLink className="mr-2 h-4.5 w-4.5" />
                    {t('businessDisabled.payNow')}
                  </Button>
                </a>

                <Button
                  variant="outline"
                  onClick={onSignOut}
                  className="cursor-pointer w-full max-w-xs h-11 text-sm border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors duration-200"
                >
                  {t('buttons.signOut')}
                </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default BusinessDisabledModal;
