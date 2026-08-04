import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getOwnedBusinessByUserId } from '../data/queries/authQueries';
import { signInWithUsernamePassword } from '../data/commands/authCommands';
import { redirectAfterRegistration } from '../utils/deviceDetection';
import { useAppToast } from '@/hooks/useAppToast';
import { User, Lock, ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import logoStocky from '../assets/logoStocky.png';

interface LoginForm {
  username: string;
  password: string;
}

const staggerChildren = {
  initial: { opacity: 0, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.08 },
  }),
};

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginForm>({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const { showError, showWarning, ToastComponent } = useAppToast();

  useEffect(() => {
    const sessionExpired = localStorage.getItem('stocky.session_expired');
    if (sessionExpired) {
      localStorage.removeItem('stocky.session_expired');
      showWarning(t('login.sessionExpired'));
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { username, password } = formData;

      if (!username || !password) {
        showError(t('login.loginError'), t('login.enterUsernamePassword'));
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setLoading(false);
        return;
      }

      const { user } = await signInWithUsernamePassword({ username, password });
      const business = await getOwnedBusinessByUserId(user?.id as string, 'id');

      if (business) {
        redirectAfterRegistration();
      } else {
        navigate('/employee-dashboard', { replace: true });
      }
    } catch (err) {
      const msg = (err as Error).message;
      showError(
        t('login.loginError'),
        msg === 'INVALID_CREDENTIALS' ? t('login.invalidCredentials') : msg
      );
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh relative overflow-hidden flex items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat md:hidden"
        style={{ backgroundImage: "url('/images/fondo_login.webp')" }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat hidden md:block"
        style={{ backgroundImage: "url('/images/fondo_ordenador.webp')" }}
      />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
      `}</style>

      <motion.button
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate('/')}
        className="cursor-pointer fixed top-4 left-4 z-10 inline-flex items-center gap-2 rounded-xl border border-primary-200/60 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-primary-700 shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('login.back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className={`rounded-2xl bg-white/90 backdrop-blur-md border border-primary-100/60 shadow-xl shadow-primary-900/5 p-5 sm:p-6 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          <motion.div custom={0} variants={staggerChildren} initial="initial" animate="animate" className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 border border-primary-100 animate-float">
              <img src={logoStocky} alt="Stocky" className="h-9 w-9 object-contain" />
            </div>
          </motion.div>

          <motion.div custom={0} variants={staggerChildren} initial="initial" animate="animate" className="text-center mb-4">
            <h1 className="text-xl font-bold tracking-tight text-primary-900 sm:text-2xl">
              {t('login.signIn')}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('login.enterCredentials')}
            </p>
          </motion.div>

          <form onSubmit={handleLogin} className="space-y-3">
            <motion.div custom={1} variants={staggerChildren} initial="initial" animate="animate" className="space-y-1">
              <label htmlFor="username" className="text-xs font-semibold text-primary-800">
                {t('login.username')}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder={t('login.usernamePlaceholder')}
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-primary-200 bg-primary-50/40 py-2.5 pl-10 pr-4 text-sm text-primary-900 placeholder:text-primary-300 transition-all duration-200 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,59,70,0.1)] focus:outline-none"
                  required
                  autoComplete="username"
                />
              </div>
            </motion.div>

            <motion.div custom={2} variants={staggerChildren} initial="initial" animate="animate" className="space-y-1">
              <label htmlFor="password" className="text-xs font-semibold text-primary-800">
                {t('login.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-primary-200 bg-primary-50/40 py-2.5 pl-10 pr-12 text-sm text-primary-900 placeholder:text-primary-300 transition-all duration-200 focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,59,70,0.1)] focus:outline-none"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-colors duration-200"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div custom={3} variants={staggerChildren} initial="initial" animate="animate" className="pt-1.5">
              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer relative rounded-[50px] flex items-center justify-center w-full rotatingGradient disabled:opacity-50 disabled:cursor-not-allowed after:content-[''] after:block after:absolute after:bg-[#003B46] after:inset-[4px] after:rounded-[46px] after:z-[1] after:transition-opacity after:duration-300"
                style={{ height: '48px', padding: '0 30px' }}
              >
                <span className="relative z-10 text-white font-semibold text-sm flex items-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? t('login.signingIn') : t('login.signIn')}
                </span>
              </button>

              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success-500" />
                Conexión segura
              </p>
            </motion.div>
          </form>

          <motion.div custom={3} variants={staggerChildren} initial="initial" animate="animate" className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              {t('login.noAccount')}{' '}
              <button
                onClick={() => navigate('/register')}
                className="cursor-pointer font-semibold text-primary-700 hover:text-primary-800 transition-colors duration-200"
              >
                {t('login.registerBusiness')}
              </button>
            </p>
          </motion.div>

          <motion.div custom={4} variants={staggerChildren} initial="initial" animate="animate" className="mt-4 pt-3 border-t border-primary-100 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <a href="/terms" className="cursor-pointer transition-colors duration-200 hover:text-primary-700">
              {t('home.terms')}
            </a>
            <span className="text-primary-200">·</span>
            <a href="/privacy" className="cursor-pointer transition-colors duration-200 hover:text-primary-700">
              {t('home.privacy')}
            </a>
          </motion.div>
        </div>
      </motion.div>

      <ToastComponent />
    </div>
  );
}

export default Login;
