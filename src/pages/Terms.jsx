// ============================================
// 📜 Página de Términos y Condiciones
// ============================================
// Ubicación: src/pages/Terms.jsx

import { Shield, FileText, AlertTriangle, CheckCircle2, Info, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <FileText className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Términos y Condiciones</h1>
              <p className="text-primary-100 mt-2">Stocky - Sistema de Gestión POS</p>
              <p className="text-sm text-primary-200 mt-1">Última actualización: 16 de enero de 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-8 space-y-8">
            
            {/* Sección 1 */}
            <Section
              number="1"
              title="ACEPTACIÓN DE LOS TÉRMINOS"
              icon={CheckCircle2}
              color="green"
            >
              <p>
                Al registrarse y usar Stocky (en adelante, "el Servicio"), usted (en adelante, "el CLIENTE") 
                acepta quedar vinculado por estos Términos y Condiciones. Si no está de acuerdo con estos 
                términos, no debe usar el Servicio.
              </p>
              <p className="mt-3">
                Stocky es un software como servicio (SaaS) de gestión de punto de venta desarrollado por 
                [Nombre de la Empresa], destinado a facilitar operaciones comerciales de pequeños y medianos negocios.
              </p>
            </Section>

            {/* Sección 2 */}
            <Section
              number="2"
              title="DESCRIPCIÓN DEL SERVICIO"
              icon={Info}
              color="blue"
            >
              <p className="font-semibold mb-2">Stocky proporciona:</p>
              <ul className="space-y-2 ml-6">
                <li>✓ Sistema de punto de venta (POS) para registro de transacciones</li>
                <li>✓ Gestión de inventario y productos</li>
                <li>✓ Control de empleados y permisos</li>
                <li>✓ Reportes y análisis de ventas</li>
                <li>✓ Gestión de clientes y proveedores</li>
                <li>✓ <strong>Generación de comprobantes informativos</strong> (NO válidos ante DIAN)</li>
              </ul>
              <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <p className="text-sm text-amber-900 font-semibold">
                  ⚠️ IMPORTANTE: Stocky NO proporciona servicios de facturación electrónica ni emite 
                  documentos con validez fiscal ante la DIAN.
                </p>
              </div>
            </Section>

            {/* Sección 8 - FACTURACIÓN ELECTRÓNICA (LA MÁS IMPORTANTE) */}
            <Section
              number="8"
              title="FACTURACIÓN ELECTRÓNICA Y OBLIGACIONES FISCALES"
              icon={Shield}
              color="red"
              highlighted
            >
              <div className="space-y-4">
                <SubSection title="8.1 NATURALEZA DEL SERVICIO">
                  <p>
                    Stocky es una herramienta de gestión operativa y punto de venta (POS) que <strong>NO presta 
                    servicios de facturación electrónica</strong> ni actúa como proveedor tecnológico autorizado 
                    por la Dirección de Impuestos y Aduanas Nacionales (DIAN) de Colombia.
                  </p>
                  <p className="mt-2">
                    Stocky NO está habilitado, certificado ni autorizado para:
                  </p>
                  <ul className="mt-2 ml-6 space-y-1">
                    <li>❌ Emitir facturas electrónicas de venta</li>
                    <li>❌ Generar documentos equivalentes con validez fiscal</li>
                    <li>❌ Transmitir información tributaria a la DIAN</li>
                    <li>❌ Actuar como intermediario en procesos de facturación</li>
                  </ul>
                </SubSection>

                <SubSection title="8.2 RESPONSABILIDAD FISCAL DEL CLIENTE">
                  <p className="font-semibold mb-2">El CLIENTE es el único y exclusivo responsable de:</p>
                  <ul className="ml-6 space-y-2">
                    <li>
                      ✓ <strong>Cumplir con sus obligaciones tributarias</strong> según su régimen fiscal 
                      (responsable de IVA, régimen simple, gran contribuyente, etc.)
                    </li>
                    <li>
                      ✓ <strong>Emitir facturas electrónicas</strong> mediante un proveedor tecnológico 
                      autorizado por la DIAN (Siigo, Alegra, Facturador, etc.)
                    </li>
                    <li>
                      ✓ <strong>Conservar documentos fiscales</strong> según lo requiere la normativa vigente 
                      (mínimo 10 años)
                    </li>
                    <li>
                      ✓ <strong>Declarar y pagar oportunamente</strong> todos los impuestos aplicables (IVA, 
                      Renta, ICA, Retención en la fuente, etc.)
                    </li>
                    <li>
                      ✓ <strong>Garantizar que cada venta registrada</strong> en Stocky sea debidamente 
                      facturada ante la DIAN cuando corresponda
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="8.3 COMPROBANTES INFORMATIVOS">
                  <p>
                    Los documentos generados por Stocky (tickets, comprobantes, recibos) son <strong>únicamente 
                    para control interno y registro operativo</strong>. Estos documentos:
                  </p>
                  <ul className="mt-2 ml-6 space-y-1">
                    <li>❌ NO constituyen facturas de venta</li>
                    <li>❌ NO son documentos equivalentes según la DIAN</li>
                    <li>❌ NO tienen validez fiscal ni tributaria</li>
                    <li>❌ NO son soportes válidos para deducciones fiscales</li>
                    <li>❌ NO sirven como soporte contable ante autoridades</li>
                    <li>❌ NO eximen al CLIENTE de su obligación de facturar</li>
                  </ul>
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-900">
                      <strong>Advertencia Legal:</strong> El uso de estos comprobantes como sustituto de 
                      facturas electrónicas constituye incumplimiento de obligaciones fiscales y puede 
                      derivar en sanciones por parte de la DIAN.
                    </p>
                  </div>
                </SubSection>

                <SubSection title="8.4 INTEGRACIÓN CON SIIGO (OPCIONAL)">
                  <p>
                    Algunos planes de Stocky pueden incluir acceso a <strong>Siigo</strong>, un proveedor 
                    autorizado de facturación electrónica. En estos casos:
                  </p>
                  <ul className="mt-2 ml-6 space-y-2">
                    <li>
                      ✓ El CLIENTE mantiene <strong>relación contractual directa con Siigo</strong>, no con Stocky
                    </li>
                    <li>
                      ✓ Stocky puede <strong>facilitar exportación de datos</strong> hacia Siigo, pero NO 
                      intermedia en la emisión de facturas
                    </li>
                    <li>
                      ✓ Es responsabilidad del CLIENTE <strong>validar que cada factura sea transmitida a la DIAN</strong>
                    </li>
                    <li>
                      ✓ Stocky NO garantiza disponibilidad, funcionamiento ni soporte del servicio de Siigo
                    </li>
                    <li>
                      ✓ Cualquier problema con facturación debe resolverse <strong>directamente con Siigo</strong>
                    </li>
                  </ul>
                </SubSection>

                <SubSection title="8.5 INDEMNIDAD Y EXONERACIÓN DE RESPONSABILIDAD">
                  <p className="font-semibold mb-2">
                    El CLIENTE se compromete a mantener indemne a Stocky, sus propietarios, empleados y 
                    afiliados, de cualquier:
                  </p>
                  <ul className="ml-6 space-y-2">
                    <li>• Sanción impuesta por la DIAN por falta de facturación electrónica</li>
                    <li>• Multa derivada de incumplimiento de obligaciones tributarias</li>
                    <li>• Proceso administrativo o judicial relacionado con facturación</li>
                    <li>• Reclamación de terceros por ausencia de documentos fiscales válidos</li>
                    <li>• Daño o perjuicio causado por uso inadecuado de comprobantes informativos</li>
                  </ul>
                  <div className="mt-3 p-4 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                    <p className="text-sm text-gray-800 font-semibold">
                      Stocky NO asume ninguna responsabilidad por consecuencias derivadas de:
                    </p>
                    <ul className="mt-2 ml-4 text-sm text-gray-700 space-y-1">
                      <li>- Falta de emisión de facturas electrónicas oficiales</li>
                      <li>- Uso de comprobantes de Stocky como documentos fiscales</li>
                      <li>- Incumplimiento de plazos de declaración tributaria</li>
                      <li>- Errores en información fiscal suministrada a terceros</li>
                    </ul>
                  </div>
                </SubSection>

                <SubSection title="8.6 OBLIGACIÓN DE INFORMACIÓN">
                  <p>
                    El CLIENTE reconoce haber sido informado de que:
                  </p>
                  <ul className="mt-2 ml-6 space-y-1">
                    <li>1. Stocky NO es un software de facturación electrónica</li>
                    <li>2. Los comprobantes generados NO reemplazan facturas oficiales</li>
                    <li>3. Debe contratar un proveedor autorizado para facturar (ej: Siigo)</li>
                    <li>4. El incumplimiento fiscal es su exclusiva responsabilidad</li>
                  </ul>
                </SubSection>
              </div>
            </Section>

            {/* Otras secciones relevantes */}
            <Section
              number="3"
              title="OBLIGACIONES DEL CLIENTE"
              icon={AlertTriangle}
              color="amber"
            >
              <ul className="space-y-2 ml-6">
                <li>• Proporcionar información veraz y actualizada</li>
                <li>• Mantener la confidencialidad de sus credenciales de acceso</li>
                <li>• Usar el servicio conforme a la ley y estos términos</li>
                <li>• <strong>Cumplir con todas sus obligaciones fiscales y tributarias</strong></li>
                <li>• No usar el servicio para actividades ilegales o fraudulentas</li>
                <li>• Realizar backups periódicos de su información crítica</li>
              </ul>
            </Section>

            <Section
              number="4"
              title="LIMITACIÓN DE RESPONSABILIDAD"
              icon={Shield}
              color="purple"
            >
              <p>
                Stocky proporciona el servicio "tal cual" y no garantiza:
              </p>
              <ul className="mt-2 ml-6 space-y-1">
                <li>• Disponibilidad ininterrumpida del servicio (uptime 100%)</li>
                <li>• Ausencia total de errores o bugs</li>
                <li>• Compatibilidad con todo hardware o software de terceros</li>
                <li>• Resultados específicos de negocio o ventas</li>
              </ul>
              <p className="mt-3 font-semibold">
                La responsabilidad máxima de Stocky ante el CLIENTE se limita al valor pagado por el servicio 
                durante los últimos 3 meses.
              </p>
            </Section>

            <Section
              number="5"
              title="PROTECCIÓN DE DATOS PERSONALES"
              icon={Shield}
              color="blue"
            >
              <p>
                Stocky cumple con la Ley 1581 de 2012 de Protección de Datos Personales de Colombia. 
                Los datos del CLIENTE y sus clientes son:
              </p>
              <ul className="mt-2 ml-6 space-y-1">
                <li>✓ Almacenados de forma segura y encriptada</li>
                <li>✓ Utilizados únicamente para prestación del servicio</li>
                <li>✓ No compartidos con terceros sin consentimiento</li>
                <li>✓ Respaldados regularmente para prevenir pérdidas</li>
              </ul>
              <p className="mt-3">
                El CLIENTE puede solicitar acceso, rectificación o eliminación de sus datos en cualquier momento.
              </p>
            </Section>

            {/* Aceptación final */}
            <div className="mt-12 p-6 bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200 rounded-xl">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-primary-600 shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-primary-900 text-lg mb-2">
                    Aceptación de Términos
                  </h3>
                  <p className="text-primary-800 text-sm leading-relaxed">
                    Al utilizar Stocky, usted confirma haber leído, entendido y aceptado estos Términos y 
                    Condiciones en su totalidad, <strong>especialmente la Sección 8 sobre Facturación Electrónica 
                    y Obligaciones Fiscales</strong>.
                  </p>
                  <p className="text-primary-700 text-xs mt-3">
                    Para preguntas o aclaraciones, contáctenos en: <strong>soporte@stockly.com</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Componente de sección
function Section({ number, title, icon: _Icon, color, children, highlighted = false }) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-500',
    blue: 'from-blue-500 to-cyan-500',
    red: 'from-red-500 to-rose-500',
    amber: 'from-amber-500 to-orange-500',
    purple: 'from-purple-500 to-pink-500',
  };

  const bgColorClasses = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
    amber: 'bg-amber-50 border-amber-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div className={highlighted ? 'border-2 border-red-300 rounded-xl p-4 bg-red-50/30' : ''}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-xl shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm font-bold">
              #{number}
            </span>
            {highlighted && (
              <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold animate-pulse">
                IMPORTANTE
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mt-2">{title}</h2>
        </div>
      </div>
      <div className="ml-16 space-y-3 text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// Componente de subsección
function SubSection({ title, children }) {
  return (
    <div className="pl-4 border-l-2 border-gray-300">
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <div className="text-gray-700 space-y-2">
        {children}
      </div>
    </div>
  );
}
