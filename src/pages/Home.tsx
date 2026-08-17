import { useEffect, useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { signOutSession } from '../data/commands/authCommands';
import GradientButton from '../components/ui/gradient-button';
import { useViewport } from '../hooks/useViewport.js';
import {
  ArrowDown,
  ShoppingCart,
  Receipt,
  BarChart3,
  Users,
  Shield,
  Clock3,
  Check,
  ChevronDown,
  Star,
  TrendingUp,
} from 'lucide-react';
import logoStocky from '../assets/logoStocky.png';
import { LanguageSwitch } from '../components/ui/language-switch';
import {
  ScrollReveal,
  AnimatedCounter,
  BentoCard,
  PhoneMockup,
  StickyBottomBar,
} from '../components/landing';

const SplineScene = lazy(() => import('../components/ui/splite').then(m => ({ default: m.SplineScene })));
const TestimonialCarousel = lazy(() => import('../components/landing/TestimonialCarousel').then(m => ({ default: m.TestimonialCarousel })));

function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile, isDesktop } = useViewport();

  const processSteps = useMemo(() => [t('home.addProducts'), t('home.sellAndControl'), t('home.reviewAndImprove')], [t]);

  const modules = useMemo(() => [
    { icon: ShoppingCart, title: t('home.fastCheckout'), text: t('home.fastCheckoutDesc'), gradient: 'bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white' },
    { icon: Receipt, title: t('home.simpleBilling'), text: t('home.simpleBillingDesc'), gradient: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' },
    { icon: BarChart3, title: t('home.clearReports'), text: t('home.clearReportsDesc'), gradient: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' },
    { icon: Users, title: t('home.employeeControl'), text: t('home.employeeControlDesc'), gradient: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' },
    { icon: Shield, title: t('home.secureInfo'), text: t('home.secureInfoDesc'), gradient: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white' },
    { icon: Clock3, title: t('home.easyCloseout'), text: t('home.easyCloseoutDesc'), gradient: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white' },
  ], [t]);

  const testimonials = useMemo(() => [
    { text: t('home.testimonial1.text'), name: t('home.testimonial1.name'), role: t('home.testimonial1.role') },
    { text: t('home.testimonial2.text'), name: t('home.testimonial2.name'), role: t('home.testimonial2.role') },
    { text: t('home.testimonial3.text'), name: t('home.testimonial3.name'), role: t('home.testimonial3.role') },
  ], [t]);

  const faqs = useMemo(() => [
    { question: t('home.faq1.question'), answer: t('home.faq1.answer') },
    { question: t('home.faq2.question'), answer: t('home.faq2.answer') },
    { question: t('home.faq3.question'), answer: t('home.faq3.answer') },
    { question: t('home.faq4.question'), answer: t('home.faq4.answer') },
  ], [t]);

  useEffect(() => {
    const signOut = async () => {
      try {
        await signOutSession();
      } catch (err) {
        logger.warn('home:signout_on_load failed', err);
      }
    };
    signOut();
  }, []);

  return (
    <div className="relative min-h-screen bg-white text-primary-900 antialiased overflow-x-hidden">
      {}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary-100/40 blur-2xl sm:blur-3xl animate-[drift_14s_ease-in-out_infinite]" style={{ willChange: 'transform' }} />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-primary-50/50 blur-2xl sm:blur-3xl animate-[drift_18s_ease-in-out_infinite_3s]" style={{ willChange: 'transform' }} />
        <div className="absolute -bottom-20 right-1/4 h-[20rem] w-[20rem] rounded-full bg-secondary-100/30 blur-2xl sm:blur-3xl animate-[drift_20s_ease-in-out_infinite_6s]" style={{ willChange: 'transform' }} />
      </div>

      <style>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>

      {}
      <header className="sticky top-0 z-40 border-b border-primary-100/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="cursor-pointer inline-flex items-center gap-2.5 rounded-lg -ml-2 px-2 py-1.5 transition-colors duration-200 hover:bg-primary-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" loading="eager" />
            </span>
            <span className="text-lg font-bold tracking-tight text-primary-900">Stocky</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.modules')}</a>
            <a href="#process" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.process')}</a>
            <a href="#testimonials" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.testimonialsTitle')}</a>
            <a href="#faq" className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.faqTitle')}</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitch />
            <button onClick={() => navigate('/login')} className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-black transition-colors duration-200 hover:bg-primary-50">{t('home.signIn')}</button>
            <GradientButton onClick={() => navigate('/register')} variant="small" className="text-sm">{t('home.createAccount')}</GradientButton>
          </div>
        </div>
      </header>

      <main>
        {}
        <section className="relative px-4 pb-14 pt-12 sm:px-6 sm:pb-18 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {}
              <div className="flex-1 text-center lg:text-left">
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="text-3xl font-bold leading-[1.12] tracking-tight text-primary-900 sm:text-4xl lg:text-5xl"
                >
                  {t('home.stockyDescription')}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base mx-auto lg:mx-0"
                >
                  {t('home.platformDescription')}
                </motion.p>

                {}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.6 }}
                  className="mt-6 flex items-center justify-center lg:justify-start gap-4 text-xs text-muted-foreground"
                >
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-success-500" />Descarga en la play store</span>
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-success-500" />2 minutos</span>
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-success-500" />Gratis</span>
                </motion.div>
              </div>

              {}
              {!isMobile && isDesktop && (
                <div className="flex-1 w-full lg:w-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="relative w-full h-[400px] lg:h-[500px] bg-white rounded-2xl overflow-hidden"
                  >
                    <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl" />}>
                      <SplineScene
                        scene="https://prod.spline.design/c81LtkO3jIPTCgFo/scene.splinecode"
                        className="w-full h-full pointer-events-none"
                      />
                    </Suspense>
                  </motion.div>
                </div>
              )}

              {}
              {isMobile && (
                <div className="w-full flex justify-center">
                  <PhoneMockup screenshots={['/images/screenshot-hero-1.webp']} className="scale-90" />
                </div>
              )}
            </div>
          </div>

          {}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="mt-8 flex flex-col items-center gap-1 text-xs text-muted-foreground"
            >
              <ArrowDown className="h-4 w-4 animate-bounce" />
              <span>{t('home.scrollDown')}</span>
            </motion.div>
          )}
        </section>

        {}
        <section className="border-t border-primary-100 bg-white/50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal>
              <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">{t('home.trustTitle')}</p>
            </ScrollReveal>
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              {[
                { value: 500, suffix: '+', label: t('home.trustNegociosLabel') },
                { value: 99.9, decimals: 1, suffix: '%', label: t('home.trustUptimeLabel') },
                { value: 50, suffix: 'K', label: t('home.trustVentasLabel') },
              ].map((stat) => (
                <ScrollReveal key={stat.label} className="text-center">
                  <p className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} decimals={stat.decimals || 0} />
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {}
        <section id="features" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
          <div className="mx-auto max-w-7xl">
            <ScrollReveal className="mb-10 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">{t('home.modules')}</p>
              <h2 className="text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">{t('home.featuresTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('home.featuresSubtitle')}</p>
            </ScrollReveal>

            {}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <BentoCard variant="large" icon={modules[0].icon} title={modules[0].title} description={modules[0].text} gradient={modules[0].gradient} index={0}>
                <div className="mt-auto">
                  <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100">
                        <ShoppingCart className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="text-green-300 text-xs font-medium">→</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100">
                        <Receipt className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="text-green-300 text-xs font-medium">→</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-green-300" style={{ opacity: 1 - i * 0.18 }} />
                          <Check className="h-3 w-3 shrink-0 text-green-500" />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-green-700">Ventas hoy</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        +12%
                      </span>
                    </div>
                  </div>
                </div>
              </BentoCard>

              {modules.slice(1).map((mod, i) => (
                <BentoCard key={mod.title} variant={i === 4 ? 'wide' : 'small'} icon={mod.icon} title={mod.title} description={mod.text} gradient={mod.gradient} index={i + 1} />
              ))}
            </div>
          </div>
        </section>

        {}
        <section id="process" className="border-t border-primary-100 bg-white/30 px-4 py-14 sm:px-6 sm:py-20 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
          <div className="mx-auto max-w-lg">
            <ScrollReveal className="mb-10 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">{t('home.process')}</p>
              <h2 className="text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">{t('home.howItWorksTitle')}</h2>
            </ScrollReveal>

            <div className="relative">
              {}
              <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-primary-100 origin-top animate-line-draw" />

              <div className="space-y-8">
                {processSteps.map((step, i) => (
                  <ScrollReveal key={step} delay={i * 120} className="relative flex gap-5">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white shadow-md">
                      {i + 1}
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-sm font-medium text-primary-900 sm:text-base">{step}</p>
                      {i === 0 && <p className="mt-1 text-xs text-muted-foreground">{t('home.fastCheckoutDesc')}</p>}
                      {i === 1 && <p className="mt-1 text-xs text-muted-foreground">{t('home.simpleBillingDesc')}</p>}
                      {i === 2 && <p className="mt-1 text-xs text-muted-foreground">{t('home.clearReportsDesc')}</p>}
                      <div className="mt-2 inline-flex items-center gap-1.5 text-success-600">
                        <Check className="h-3 w-3" />
                        <span className="text-xs font-semibold">{t('home.readyToExecute')}</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {}
        <section id="testimonials" className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 350px' }}>
          <div className="mx-auto max-w-2xl">
            <ScrollReveal className="mb-10 text-center">
              <div className="mb-3 inline-flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((i) => (<Star key={i} className="h-4 w-4 fill-current" />))}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">{t('home.testimonialsTitle')}</h2>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <Suspense fallback={<div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />}>
                <TestimonialCarousel testimonials={testimonials} />
              </Suspense>
            </ScrollReveal>
          </div>
        </section>

        {}
        <section id="faq" className="border-t border-primary-100 bg-white/30 px-4 py-14 sm:px-6 sm:py-20 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
          <div className="mx-auto max-w-2xl">
            <ScrollReveal className="mb-10 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">{t('home.faqTitle')}</p>
              <h2 className="text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">{t('home.faqTitle')}</h2>
            </ScrollReveal>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <ScrollReveal key={faq.question} delay={i * 80}>
                  <details className="group rounded-xl border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-sm">
                    <summary className="cursor-pointer flex items-center justify-between gap-3 p-4 sm:p-5">
                      <span className="text-sm font-semibold text-primary-900 sm:text-base">{faq.question}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                      <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                    </div>
                  </details>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {}
        <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}>
          <div className="mx-auto max-w-7xl">
            <ScrollReveal>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-center sm:p-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(102,165,173,0.25),transparent_70%)]" />
                <div className="relative">
                  <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('home.ctaTitle')}</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-primary-100 sm:text-base">{t('home.ctaSubtitle')}</p>
                  <div className="mt-6 inline-block animate-glow-pulse rounded-full">
                    <GradientButton onClick={() => navigate('/register')} minWidth="220px" height="48px">{t('home.ctaButton')}</GradientButton>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {}
      <footer className="border-t border-primary-100 bg-white px-4 py-8 sm:px-6 lg:px-8" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 120px' }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
              <img src={logoStocky} alt="Stocky" className="h-6 w-6 object-contain" loading="lazy" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary-900">Stocky</p>
              <p className="text-xs text-muted-foreground">{t('home.posSystem')}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <a href="/terms" className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.terms')}</a>
            <a href="/privacy" className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.privacy')}</a>
            <a href="/legal/delete-account.html" className="cursor-pointer font-medium text-muted-foreground transition-colors duration-200 hover:text-primary-700">{t('home.deleteAccount')}</a>
          </div>
          <div className="text-xs text-muted-foreground">&copy; 2026 Stocky. {t('home.allRightsReserved')}</div>
        </div>
        {}
        <div className="mt-6 md:hidden h-1" />
      </footer>

      {}
      <StickyBottomBar />
    </div>
  );
}

export default Home;
