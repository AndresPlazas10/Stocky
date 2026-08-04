import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useViewport } from '../../hooks/useViewport';
import GradientButton from '../ui/gradient-button';

export function StickyBottomBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useViewport();

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4">
      <div
        className="mx-auto flex items-center justify-center gap-3 px-4 py-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
      >
        <button
          onClick={() => navigate('/login')}
          className="cursor-pointer rounded-xl border border-primary-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 transition-colors duration-200 hover:bg-primary-50 active:bg-primary-100 whitespace-nowrap"
        >
          {t('home.bottomBarSignIn')}
        </button>
        <GradientButton
          onClick={() => navigate('/register')}
          minWidth="140px"
          height="44px"
          variant="small"
        >
          {t('home.bottomBarSignUp')}
        </GradientButton>
      </div>
    </div>
  );
}
