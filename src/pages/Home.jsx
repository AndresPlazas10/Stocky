import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase/Client.jsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Store,
  Package,
  TrendingUp,
  Users,
  BarChart3,
  ShoppingCart,
  Coffee,
  Utensils,
  Zap,
  Check,
  ArrowRight,
  Menu,
  X,
  Shield,
} from "lucide-react";

function Home() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cerrar sesión al cargar la página
  useEffect(() => {
    const signOut = async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        // Error silencioso
      }
    };
    signOut();
  }, []);

  const features = [
    {
      icon: Store,
      title: "Gestión de Inventario",
      description:
        "Control completo de tus productos, stock y movimientos en tiempo real.",
    },
    {
      icon: ShoppingCart,
      title: "Punto de Venta",
      description:
        "Sistema POS rápido y eficiente para procesar ventas en segundos.",
    },
    {
      icon: BarChart3,
      title: "Reportes Inteligentes",
      description:
        "Analiza tu negocio con reportes detallados y visualizaciones claras.",
    },
    {
      icon: Users,
      title: "Multi-Usuario",
      description: "Gestiona empleados y permisos de acceso para tu equipo.",
    },
    {
      icon: TrendingUp,
      title: "Analytics Avanzado",
      description:
        "Toma decisiones informadas con métricas de rendimiento en tiempo real.",
    },
    {
      icon: Shield,
      title: "Seguro y Confiable",
      description:
        "Tus datos protegidos con la mejor infraestructura de seguridad.",
    },
  ];

  const benefits = [
    "Control total de inventario",
    "Ventas y facturación rápida",
    "Reportes en tiempo real",
    "Gestión de empleados",
    "Acceso desde cualquier dispositivo",
    "Soporte técnico 24/7",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-50 via-background-100 to-accent-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-primary-900">
                Stockly
              </span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm font-medium text-primary-700 hover:text-accent-600 transition-colors"
              >
                Características
              </a>
              <a
                href="#benefits"
                className="text-sm font-medium text-primary-700 hover:text-accent-600 transition-colors"
              >
                Beneficios
              </a>
              <Button
                variant="ghost"
                onClick={() => navigate("/login")}
                className="text-primary-700"
              >
                Iniciar Sesión
              </Button>
              <Button
                onClick={() => navigate("/register")}
                className="gradient-primary text-white hover:opacity-90"
              >
                Comenzar Gratis
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-accent-100 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t glass-card"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <a
                href="#features"
                className="py-2 text-sm font-medium text-primary-700 hover:text-accent-600"
              >
                Características
              </a>
              <a
                href="#benefits"
                className="py-2 text-sm font-medium text-primary-700 hover:text-accent-600"
              >
                Beneficios
              </a>
              <div className="flex flex-col gap-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Iniciar Sesión
                </Button>
                <Button
                  onClick={() => navigate("/register")}
                  className="w-full gradient-primary text-white"
                >
                  Comenzar Gratis
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>
        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-100 text-accent-700 text-sm font-medium mb-6"
            >
              <Zap className="w-4 h-4" />
              <span>Sistema POS para restaurantes y bares</span>
            </motion.div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary-900 mb-6 animate-fade-in leading-tight">
              Gestiona tu negocio con{" "}
              <span className="bg-gradient-to-r from-accent-500 to-secondary-500 bg-clip-text text-transparent">
                Stockly
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-primary-600 mb-8 max-w-2xl mx-auto animate-fade-in px-4">
              La solución completa para controlar inventario, ventas y reportes
              de tu restaurante o bar. Simple, rápido y confiable.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="gradient-primary text-white hover:opacity-90 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 hover-lift w-full sm:w-auto"
              >
                Comienza Gratis
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                className="border-2 border-accent-500 text-accent-700 hover:bg-accent-50 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 w-full sm:w-auto"
              >
                Ver Demo
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-900 mb-4 px-4">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-base sm:text-lg text-primary-600 max-w-2xl mx-auto px-4">
              Stockly ofrece las herramientas esenciales para gestionar tu
              negocio de manera eficiente
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 sm:p-6 h-full hover-lift group cursor-pointer">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-accent flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-900" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-primary-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-primary-600">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-900 mb-6">
                ¿Por qué elegir Stockly?
              </h2>
              <p className="text-base sm:text-lg text-primary-600 mb-8">
                Diseñado específicamente para restaurantes y bares, Stockly
                simplifica la gestión diaria de tu negocio.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm sm:text-base text-primary-700">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <Card className="p-4 sm:p-6 md:p-8">
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-accent-100 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-accent-600" />
                    </div>
                  </div>
                  <div className="h-px bg-primary-200"></div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent-100 flex items-center justify-center">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-accent-600" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-primary-600">
                        Gestión de Equipo
                      </div>
                      <div className="text-sm sm:text-base font-semibold text-primary-900">
                        Control completo
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent-100 flex items-center justify-center">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-accent-600" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-primary-600">Inventario</div>
                      <div className="text-sm sm:text-base font-semibold text-primary-900">
                        En tiempo real
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-900 to-secondary-800 text-white relative overflow-hidden">
        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Comienza a gestionar tu negocio hoy
            </h2>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-white/90 px-4">
              Únete a miles de negocios que ya confían en Stockly para su
              gestión diaria
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="bg-white text-primary-900 hover:bg-white/90 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 hover-lift w-full sm:w-auto"
              >
                Crear Cuenta Gratis
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                className="border-2 border-white text-white hover:bg-white/10 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 w-full sm:w-auto"
              >
                Iniciar Sesión
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-primary-950 text-white/70">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <span className="text-base sm:text-lg font-bold text-white">Stockly</span>
              </div>
              <p className="text-xs sm:text-sm">
                Sistema POS completo para restaurantes y bares
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">Producto</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    Características
                  </a>
                </li>
                <li>
                  <a
                    href="#benefits"
                    className="hover:text-white transition-colors"
                  >
                    Beneficios
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">Soporte</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentación
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacidad
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Términos
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t border-white/10 text-center text-xs sm:text-sm">
            <p>© 2025 Stockly. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
