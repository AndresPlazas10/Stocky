import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '../lib/supabase';

type AuthMode = 'signin' | 'signup';

type IconName = ComponentProps<typeof Ionicons>['name'];

type SignInForm = {
  username: string;
  password: string;
};

type SignUpForm = {
  name: string;
  nit: string;
  address: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
};

function normalizeUsername(value: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsernameToEmail(username: string) {
  const cleanUsername = normalizeUsername(username);
  return {
    cleanUsername,
    email: `${cleanUsername}@stockly-app.com`,
  };
}

function normalizeOptional(value: string) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

function isMissingCreateBusinessRpc(errorLike: unknown) {
  const message = String((errorLike as any)?.message || '').toLowerCase();
  return message.includes('create_business_for_current_user')
    && (message.includes('does not exist') || message.includes('not found'));
}

function mapSignUpError(errorLike: unknown): Error {
  const errorMsg = String((errorLike as any)?.message || '');
  const lower = errorMsg.toLowerCase();

  if (lower.includes('already registered') || errorMsg === 'User already registered') {
    return new Error('❌ Ya existe una cuenta con este nombre de usuario. Intenta con otro nombre.');
  }
  if (lower.includes('password')) {
    return new Error('❌ La contraseña debe tener al menos 6 caracteres');
  }
  if (lower.includes('email')) {
    return new Error('❌ El formato del correo es inválido');
  }

  return new Error(`❌ Error al crear la cuenta: ${errorMsg || 'Error desconocido'}`);
}

async function createBusinessWithFallback({
  userId,
  name,
  nit,
  address,
  phone,
  email,
  username,
}: {
  userId: string;
  name: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
  username: string;
}): Promise<{ id: string }> {
  const client = getSupabaseClient();

  const rpcResult = await client.rpc('create_business_for_current_user', {
    p_name: name,
    p_nit: normalizeOptional(nit),
    p_address: normalizeOptional(address),
    p_phone: normalizeOptional(phone),
    p_email: email,
    p_username: username,
  });

  if (!rpcResult.error) {
    const rpcData = rpcResult.data as any;
    const businessId = String(rpcData?.id || '').trim();
    if (!businessId) {
      throw new Error('❌ Error al crear el negocio');
    }
    return { id: businessId };
  }

  if (!isMissingCreateBusinessRpc(rpcResult.error)) {
    throw rpcResult.error;
  }

  const insertResult = await client
    .from('businesses')
    .insert([
      {
        name,
        nit: normalizeOptional(nit),
        address: normalizeOptional(address),
        phone: normalizeOptional(phone),
        email,
        username,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .maybeSingle();

  if (insertResult.error) {
    throw insertResult.error;
  }

  const businessId = String(insertResult.data?.id || '').trim();
  if (!businessId) {
    throw new Error('❌ Error al crear el negocio');
  }

  return { id: businessId };
}

function AuthInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure = false,
  showToggle = false,
  isVisible = false,
  onToggleVisibility,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  icon: IconName;
  secure?: boolean;
  showToggle?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={22} color="#111827" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          secureTextEntry={secure && !isVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {showToggle ? (
          <Pressable onPress={onToggleVisibility} hitSlop={8}>
            <Ionicons name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={24} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AuthScreen() {
  const { height: viewportHeight } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>('signin');
  const allowSignUp = false;

  const [signInForm, setSignInForm] = useState<SignInForm>({
    username: '',
    password: '',
  });

  const [signUpForm, setSignUpForm] = useState<SignUpForm>({
    name: '',
    nit: '',
    address: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isSignIn = mode === 'signin';

  const canSubmit = useMemo(() => {
    if (isSignIn) {
      return signInForm.username.trim().length > 2 && signInForm.password.trim().length >= 6;
    }

    return signUpForm.name.trim().length > 1
      && signUpForm.username.trim().length >= 3
      && signUpForm.password.trim().length >= 6
      && signUpForm.confirmPassword.trim().length >= 6;
  }, [isSignIn, signInForm.password, signInForm.username, signUpForm]);

  const submitSignIn = async () => {
    const username = normalizeUsername(signInForm.username);
    const password = signInForm.password;

    if (!username || !password) {
      throw new Error('⚠️ Por favor ingresa usuario y contraseña');
    }

    const client = getSupabaseClient();
    const { email } = normalizeUsernameToEmail(username);
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error('❌ Usuario o contraseña incorrectos');
    }
  };

  const submitSignUp = async () => {
    const name = signUpForm.name.trim();
    const username = normalizeUsername(signUpForm.username);
    const password = signUpForm.password;
    const confirmPassword = signUpForm.confirmPassword;

    if (!name || !username || !password) {
      throw new Error('⚠️ Por favor completa todos los campos requeridos');
    }

    if (/^\d+$/.test(name)) {
      throw new Error('❌ El nombre del negocio no puede ser solo números');
    }

    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(name)) {
      throw new Error('❌ El nombre del negocio debe contener al menos una letra');
    }

    if (name.length < 2) {
      throw new Error('❌ El nombre del negocio debe tener al menos 2 caracteres');
    }

    if (password !== confirmPassword) {
      throw new Error('❌ Las contraseñas no coinciden');
    }

    if (password.length < 6) {
      throw new Error('❌ La contraseña debe tener al menos 6 caracteres');
    }

    if (/^\d+$/.test(username)) {
      throw new Error('❌ El nombre de usuario no puede ser solo números');
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      throw new Error('❌ El usuario debe tener entre 3-20 caracteres (solo letras, números y guiones bajos)');
    }

    const client = getSupabaseClient();
    const usernameCheck = await client
      .from('businesses')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (usernameCheck.error) {
      throw usernameCheck.error;
    }

    if (usernameCheck.data?.id) {
      throw new Error('❌ Este nombre de usuario ya está en uso');
    }

    const { email } = normalizeUsernameToEmail(username);

    const signUp = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          business_name: name,
        },
      },
    });

    if (signUp.error) {
      throw mapSignUpError(signUp.error);
    }

    if (!signUp.data?.user?.id) {
      throw new Error('❌ Error al crear la cuenta');
    }

    if (!signUp.data?.session) {
      await client.auth.signOut();
      throw new Error('⚠️ Supabase requiere confirmación de email. Desactiva "Confirm email" para este flujo.');
    }

    const business = await createBusinessWithFallback({
      userId: signUp.data.user.id,
      name,
      nit: signUpForm.nit,
      address: signUpForm.address,
      phone: signUpForm.phone,
      email,
      username,
    });

    const ownerInsert = await client
      .from('employees')
      .insert([
        {
          user_id: signUp.data.user.id,
          business_id: business.id,
          role: 'owner',
          full_name: `${name} (Propietario)`,
        },
      ]);

    if (ownerInsert.error) {
      throw new Error(`❌ Error al crear el propietario: ${ownerInsert.error.message || 'desconocido'}`);
    }

    setMessage('Negocio registrado. Redirigiendo al dashboard...');
  };

  const submit = async () => {
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignIn) {
        await submitSignIn();
      } else {
        await submitSignUp();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo autenticar');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    if (!allowSignUp) return;
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setMessage(null);
  };

  const contentContainerStyle = [
    styles.content,
    isSignIn ? styles.contentSignIn : styles.contentSignUp,
  ];

  const cardStyle = [
    styles.card,
    !isSignIn && styles.cardSignUp,
    !isSignIn && { minHeight: Math.max(560, viewportHeight - 120) },
  ];

  return (
    <LinearGradient
      colors={['#E1E8F8', '#E8EEF8', '#EDE9FB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={contentContainerStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
            <View style={cardStyle}>
            <LinearGradient
              colors={['#4F46E5', '#A21CAF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBox}
            >
              <Ionicons name={isSignIn ? 'storefront-outline' : 'business-outline'} size={44} color="#FFFFFF" />
            </LinearGradient>

            <Text style={styles.title}>{isSignIn ? 'Iniciar Sesión' : 'Registrar Negocio'}</Text>
            <Text style={styles.subtitle}>
              {isSignIn
                ? 'Ingresa tus credenciales para acceder'
                : 'Completa la información de tu negocio para comenzar'}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.message}>{message}</Text> : null}

            {isSignIn ? (
              <>
                <AuthInput
                  label="Usuario"
                  value={signInForm.username}
                  onChangeText={(next) => setSignInForm((prev) => ({ ...prev, username: next }))}
                  placeholder="Tu nombre de usuario"
                  icon="person-outline"
                  autoCapitalize="none"
                />

                <AuthInput
                  label="Contraseña"
                  value={signInForm.password}
                  onChangeText={(next) => setSignInForm((prev) => ({ ...prev, password: next }))}
                  placeholder="Tu contraseña"
                  icon="lock-closed-outline"
                  secure
                  showToggle
                  isVisible={showSignInPassword}
                  onToggleVisibility={() => setShowSignInPassword((prev) => !prev)}
                />
              </>
            ) : (
              <>
                <AuthInput
                  label="Nombre del negocio"
                  value={signUpForm.name}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, name: next }))}
                  placeholder="Ej: Mi Cafetería"
                  icon="storefront-outline"
                  autoCapitalize="words"
                />

                <AuthInput
                  label="Usuario"
                  value={signUpForm.username}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, username: next }))}
                  placeholder="usuario_negocio"
                  icon="person-outline"
                  autoCapitalize="none"
                />

                <AuthInput
                  label="NIT (opcional)"
                  value={signUpForm.nit}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, nit: next }))}
                  placeholder="900.123.456-7"
                  icon="business-outline"
                />

                <AuthInput
                  label="Teléfono"
                  value={signUpForm.phone}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, phone: next }))}
                  placeholder="+57 300 123 4567"
                  icon="call-outline"
                  keyboardType="phone-pad"
                />

                <AuthInput
                  label="Dirección"
                  value={signUpForm.address}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, address: next }))}
                  placeholder="Calle 123 #45-67"
                  icon="location-outline"
                  autoCapitalize="words"
                />

                <AuthInput
                  label="Contraseña"
                  value={signUpForm.password}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, password: next }))}
                  placeholder="Mínimo 6 caracteres"
                  icon="lock-closed-outline"
                  secure
                  showToggle
                  isVisible={showSignUpPassword}
                  onToggleVisibility={() => setShowSignUpPassword((prev) => !prev)}
                />

                <AuthInput
                  label="Confirmar contraseña"
                  value={signUpForm.confirmPassword}
                  onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, confirmPassword: next }))}
                  placeholder="Repite la contraseña"
                  icon="lock-closed-outline"
                  secure
                  showToggle
                  isVisible={showSignUpConfirmPassword}
                  onToggleVisibility={() => setShowSignUpConfirmPassword((prev) => !prev)}
                />
              </>
            )}

            <Pressable onPress={submit} disabled={!canSubmit || loading} style={styles.submitWrap}>
              <LinearGradient
                colors={(!canSubmit || loading) ? ['#7D8AA7', '#9CA3AF'] : ['#4F46E5', '#A21CAF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButton}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.submitText}>
                  {isSignIn ? 'Iniciar Sesión' : 'Registrar Negocio'}
                </Text>
              </LinearGradient>
            </Pressable>

            {!allowSignUp ? (
              <Pressable
                onPress={() => Linking.openURL('https://wa.me/573188246925')}
                style={styles.signInHelperWrap}
              >
                <Text style={styles.signInHelper}>
                  ¿Necesitas acceso? Escríbenos por WhatsApp al 318 824 6925.
                </Text>
              </Pressable>
            ) : (
              <View style={styles.switchRow}>
                <Text style={styles.switchPrompt}>
                  {isSignIn ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                </Text>
                <Pressable onPress={switchMode}>
                  <Text style={styles.switchAction}>{isSignIn ? 'Registrar negocio' : 'Iniciar sesión'}</Text>
                </Pressable>
              </View>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
    paddingBottom: 36,
  },
  contentSignIn: {
    justifyContent: 'center',
  },
  contentSignUp: {
    justifyContent: 'flex-start',
    paddingTop: 56,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(209, 213, 219, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardSignUp: {
    justifyContent: 'flex-start',
  },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  title: {
    textAlign: 'center',
    color: '#5B33D6',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
    color: '#4B5563',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  inputGroup: {
    gap: 8,
    marginTop: 8,
  },
  inputLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minHeight: 54,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 8,
  },
  submitWrap: {
    marginTop: 16,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: '#5B33D6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
  },
  submitText: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '700',
  },
  switchRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  switchPrompt: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '500',
  },
  switchAction: {
    color: '#4C3CB0',
    fontSize: 15,
    fontWeight: '700',
  },
  signInHelperWrap: {
    marginTop: 12,
  },
  signInHelper: {
    textAlign: 'center',
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
  },
});
