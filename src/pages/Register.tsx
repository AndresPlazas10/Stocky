import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import {
  getAuthenticatedUser,
  getBusinessByEmail,
  getOwnedBusinessByUserId,
  getCurrentSession,
  isBusinessUsernameTaken
} from '../data/queries/authQueries';
import {
  createBusinessRecord,
  createEmployeeRecord,
  normalizeUsernameToEmail,
  signInWithUsernamePassword,
  signOutSession,
  signUpBusinessOwner
} from '../data/commands/authCommands';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SaleErrorAlert } from '@/components/ui/SaleErrorAlert';
import { SaleSuccessAlert } from '@/components/ui/SaleSuccessAlert';

import { Store, Building2, MapPin, Phone, User, Lock, ArrowLeft, Loader2, Eye, EyeOff, Globe, Clock } from 'lucide-react';
import { COUNTRIES } from '../config/countries';


interface RegisterForm {
  name: string;
  nit: string;
  address: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  country: string;
  timezone: string;
}

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterForm>({
    name: '',
    nit: '',
    address: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    country: '',
    timezone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { name, address, phone, username, password, confirmPassword, country } = formData;
      
      if (!name || !username || !password || !country) {
        throw new Error(t('register.fillAllFields'));
      }

      if (country === 'US' && !formData.timezone) {
        throw new Error(t('register.selectTimezone'));
      }

      if (/^\d+$/.test(name.trim())) {
        throw new Error(t('register.businessNameNotNumbers'));
      }

      if (!/[a-zA-Z]/.test(name.trim())) {
        throw new Error(t('register.businessNameMustContainLetter'));
      }

      if (name.trim().length < 2) {
        throw new Error(t('register.businessNameMinLength'));
      }

      if (password !== confirmPassword) {
        throw new Error(t('register.passwordsNotMatch'));
      }

      if (password.length < 6) {
        throw new Error(t('register.passwordMinLength'));
      }

      const cleanUsername = username.trim().toLowerCase();

      if (/^\d+$/.test(cleanUsername)) {
        throw new Error(t('register.usernameNotNumbers'));
      }

      if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new Error(t('register.usernameFormat'));
      }

      const usernameTaken = await isBusinessUsernameTaken(cleanUsername);
      if (usernameTaken) {
        throw new Error(t('register.usernameTaken'));
      }

      const { email: cleanEmail } = normalizeUsernameToEmail(cleanUsername);

      let authData = null;
      try {
        const signUpResult = await signUpBusinessOwner({
          username: cleanUsername,
          password,
          businessName: name.trim(),
          emailRedirectTo: `${window.location.origin}/dashboard`
        });
        authData = signUpResult?.authData || null;
      } catch (authError) {
        const errorMsg = (authError as Error)?.message || '';

        if (errorMsg.includes('already registered') || errorMsg === 'User already registered') {
          throw new Error(t('register.accountExists'));
        }
        if (errorMsg.includes('password')) {
          throw new Error(t('register.passwordMinLength'));
        }
        if (errorMsg.includes('email')) {
          throw new Error(t('register.invalidEmail'));
        }
        throw new Error(t('register.errorCreatingAccount') + ': ' + (errorMsg || t('errors.unknown')));
      }
      
      if (!authData.user) throw new Error(t('register.errorCreatingAccount'));

      if (!authData.session) {
        await signOutSession();
        throw new Error(t('register.emailConfirmationRequired'));
      }

      let activeUserId = authData?.session?.user?.id || null;
      if (!activeUserId) {
        try {
          await signInWithUsernamePassword({ username: cleanUsername, password });
        } catch (err) {
          logger.warn('register:relogin_after_signup failed', err);
        }
      }

      const [activeSession, activeUser] = await Promise.all([
        getCurrentSession(),
        getAuthenticatedUser()
      ]);
      activeUserId = activeUser?.id || activeSession?.user?.id || activeUserId;

      if (!activeUserId || !activeSession?.access_token) {
        throw new Error(t('register.noActiveSession'));
      }

      let businessData = null;
      try {
        businessData = await createBusinessRecord({
          name: name.trim(),
          nit: formData.nit.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: cleanEmail,
          username: cleanUsername,
          created_by: activeUserId,
          country_code: formData.country,
          timezone: formData.timezone || null
        });
      } catch (businessError) {
        await signOutSession().catch((err) => { logger.warn('register:signout_after_business_create failed', err); });
        throw new Error(t('register.errorCreatingBusinessDetails', { error: (businessError as Error)?.message || '' }));
      }

      await createEmployeeRecord({
        user_id: activeUserId,
        business_id: businessData.id,
        role: 'owner',
        full_name: name.trim() + ' (' + t('register.ownerLabel') + ')'
      });

      sessionStorage.setItem('justCreatedBusiness', businessData.id);
      sessionStorage.setItem('businessCreatedAt', Date.now().toString());
      setError('');
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (err) {
      setError((err as Error).message || t('register.errorCreatingBusiness'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await getCurrentSession();
      if (session) {
        const [ownedBusiness, emailBusiness] = await Promise.all([
          getOwnedBusinessByUserId(session.user.id, 'id'),
          session.user.email
            ?           getBusinessByEmail(session.user.email as string, 'id')
            : Promise.resolve(null)
        ]);
        const business = ownedBusiness || emailBusiness || null;
        
        if (business) {
          navigate('/dashboard');
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden overflow-y-auto flex items-start md:items-center justify-center p-3 bg-background">

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary-100/40 blur-3xl animate-[drift_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-primary-50/50 blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-secondary-100/30 blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed md:absolute top-3 left-3 z-10"
      >
        <Button
          variant="ghost"
          className="cursor-pointer h-9 bg-white/85 backdrop-blur-sm border border-primary-200 text-primary-700 hover:bg-primary-50 shadow-sm transition-colors duration-200"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('buttons.back')}
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl relative z-10 mt-12 md:mt-0 pb-4 md:pb-0"
      >
        <Card className="bg-white/95 border border-primary-100 shadow-[0_20px_45px_-22px_rgba(8,145,178,0.15)] rounded-3xl overflow-hidden">
          
          <CardHeader className="space-y-2 text-center pb-4 pt-5 relative">
            <div className="flex justify-center">
              <div className="bg-primary p-3 rounded-2xl shadow-sm">
                <Building2 className="h-8 w-8 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-primary-900 mb-1">
                {t('register.registerBusiness')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {t('register.completeBusinessInfo')}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pb-5">
            <SaleErrorAlert
              isVisible={!!error}
              onClose={() => setError('')}
              title={t('register.registrationError')}
              message={error}
              duration={5000}
            />

            <SaleSuccessAlert
              isVisible={success}
              onClose={() => setSuccess(false)}
              title={t('register.businessRegistered')}
              details={[{ label: t('labels.status'), value: t('register.redirectingToDashboard') }]}
              duration={2000}
            />

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-primary-800">
                    {t('register.businessName')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t('register.businessNameExample')}
                      value={formData.name}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="country" className="text-sm font-semibold text-primary-800">
                    {t('register.country')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={(e) => {
                        const newCountry = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          country: newCountry,
                          nit: '',
                          timezone: ''
                        }));
                      }}
                      className="w-full h-10 pl-10 pr-4 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200 rounded-xl appearance-none cursor-pointer"
                      required
                    >
                      <option value="" disabled>{t('register.selectCountry')}</option>
                      {Object.values(COUNTRIES).map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.country && COUNTRIES[formData.country]?.timezones && (
                  <div className="space-y-1 lg:col-span-2">
                    <Label htmlFor="timezone" className="text-sm font-semibold text-primary-800">
                      {t('register.timezone')} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                      <select
                        id="timezone"
                        name="timezone"
                        value={formData.timezone}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            timezone: e.target.value
                          }));
                        }}
                        className="w-full h-10 pl-10 pr-4 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200 rounded-xl appearance-none cursor-pointer"
                        required
                      >
                        <option value="" disabled>{t('register.selectTimezone')}</option>
                        {COUNTRIES[formData.country].timezones!.map(tz => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="username" className="text-sm font-semibold text-primary-800">
                    {t('register.username')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="usuario_negocio"
                      value={formData.username}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      required
                      pattern="[a-z0-9_]{3,20}"
                      title={t('register.usernameFormat')}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="nit" className="text-sm font-semibold text-primary-800">
                    {formData.country ? COUNTRIES[formData.country].taxId.name : 'NIT'} <span className="text-xs font-normal text-muted-foreground">({t('form.optional')})</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="nit"
                      name="nit"
                      type="text"
                      placeholder={formData.country ? COUNTRIES[formData.country].taxId.placeholder : t('register.selectCountryFirst')}
                      value={formData.nit}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      disabled={!formData.country}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-semibold text-primary-800">
                    {t('register.phone')}
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder={formData.country ? COUNTRIES[formData.country].phonePlaceholder : t('register.selectCountryFirst')}
                      value={formData.phone}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      disabled={!formData.country}
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="address" className="text-sm font-semibold text-primary-800">
                    {t('register.address')}
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder={t('placeholders.registerAddressExample')}
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-primary-800">
                    {t('register.password')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('register.minCharacters')}
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-700 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-primary-800">
                    {t('register.confirmPassword')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={t('register.repeatPassword')}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 pr-10 h-10 border border-primary-200 bg-primary-50/50 focus:border-primary focus-visible:ring-primary/20 transition-colors duration-200"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-primary-400 hover:text-primary-700 transition-colors duration-200"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="cursor-pointer w-full h-10 text-sm font-semibold bg-white text-black border border-gray-300 hover:bg-gray-50 transition-all duration-200 rounded-xl"
                disabled={isSubmitting || success}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('register.creatingBusiness')}
                  </>
                ) : success ? (
                  t('register.redirecting')
                ) : (
                  t('register.registerBusiness')
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground">
                  {t('register.alreadyHaveAccount')}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="cursor-pointer w-full h-10 text-sm border border-primary-200 text-primary-700 hover:bg-primary-50 rounded-xl transition-colors duration-200"
              onClick={() => navigate('/login')}
            >
              {t('register.signIn')}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Register;
