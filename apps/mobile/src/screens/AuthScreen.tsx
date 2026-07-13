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
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getSupabaseClient } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { StockyToast } from '../ui/StockyToast';
import { useToastMessages } from '../hooks/useToastMessages';
import { getErrorMessage } from '../utils/error';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { STOCKY_COLORS, STOCKY_RADIUS } from '../theme/tokens';

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
  return String(value || '')
    .trim()
    .toLowerCase();
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
  const message = getErrorMessage(errorLike).toLowerCase();
  return (
    message.includes('create_business_for_current_user') &&
    (message.includes('does not exist') || message.includes('not found'))
  );
}

function mapSignUpError(errorLike: unknown, t: (key: string) => string): Error {
  const errorMsg = getErrorMessage(errorLike);
  const lower = errorMsg.toLowerCase();

  if (lower.includes('already registered') || errorMsg === 'User already registered') {
    return new Error(`❌ ${t('auth.errors.usernameExists')}`);
  }
  if (lower.includes('password')) {
    return new Error(`❌ ${t('auth.errors.passwordTooShort')}`);
  }
  if (lower.includes('email')) {
    return new Error(`❌ ${t('auth.errors.invalidEmail')}`);
  }

  return new Error(
    `❌ ${t('auth.errors.accountCreationFailed')}: ${errorMsg || t('errors.unknown')}`,
  );
}

async function createBusinessWithFallback({
  userId,
  name,
  nit,
  address,
  phone,
  email,
  username,
  t,
}: {
  userId: string;
  name: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
  username: string;
  t: (key: string) => string;
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
    const rpcData = rpcResult.data as Record<string, unknown>;
    const businessId = String(rpcData?.id || '').trim();
    if (!businessId) {
      throw new Error(`❌ ${t('auth.errors.businessCreationFailed')}`);
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
    throw new Error(`❌ ${t('auth.errors.businessCreationFailed')}`);
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
        <Ionicons name={icon} size={22} color={STOCKY_COLORS.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8AABB2"
          style={styles.input}
          secureTextEntry={secure && !isVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {showToggle ? (
          <Pressable onPress={onToggleVisibility} hitSlop={8}>
            <Ionicons
              name={isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={STOCKY_COLORS.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AuthScreen() {
  const { t } = useTranslation();
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
  const toast = useToast();
  const toastMessages = useToastMessages();

  const isSignIn = mode === 'signin';

  const canSubmit = useMemo(() => {
    if (isSignIn) {
      return signInForm.username.trim().length > 2 && signInForm.password.trim().length >= 6;
    }

    return (
      signUpForm.name.trim().length > 1 &&
      signUpForm.username.trim().length >= 3 &&
      signUpForm.password.trim().length >= 6 &&
      signUpForm.confirmPassword.trim().length >= 6
    );
  }, [isSignIn, signInForm.password, signInForm.username, signUpForm]);

  const submitSignIn = async () => {
    const username = normalizeUsername(signInForm.username);
    const password = signInForm.password;

    if (!username || !password) {
      throw new Error(`⚠️ ${t('auth.errors.credentialsRequired')}`);
    }

    const client = getSupabaseClient();
    const { email } = normalizeUsernameToEmail(username);
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error(t('auth.errors.invalidCredentials'));
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
      throw new Error(
        '❌ El usuario debe tener entre 3-20 caracteres (solo letras, números y guiones bajos)',
      );
    }

    const client = getSupabaseClient();
    const { email } = normalizeUsernameToEmail(username);

    const usernameController = new AbortController();
    const usernameTimeoutId = setTimeout(() => usernameController.abort(), 5000);

    try {
      const [isAvailable, authResult] = await Promise.all([
        (async () => {
          try {
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

            return true;
          } finally {
            clearTimeout(usernameTimeoutId);
          }
        })(),
        client.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              business_name: name,
            },
          },
        }),
      ]);

      if (!isAvailable) {
        throw new Error(`❌ ${t('auth.errors.usernameTaken')}`);
      }

      if (authResult.error) {
        throw mapSignUpError(authResult.error, t);
      }

      if (!authResult.data?.user?.id) {
        throw new Error(`❌ ${t('auth.errors.accountCreationFailed')}`);
      }

      if (!authResult.data?.session) {
        throw new Error(`⚠️ ${t('auth.errors.emailConfirmationRequired')}`);
      }

      const userId = authResult.data.user.id;

      toast.showSuccess(toastMessages.auth.accountCreated());

      createBusinessWithFallback({
        userId,
        name,
        nit: signUpForm.nit,
        address: signUpForm.address,
        phone: signUpForm.phone,
        email,
        username,
        t,
      })
        .then((business) =>
          client.from('employees').insert([
            {
              user_id: userId,
              business_id: business.id,
              role: 'owner',
              full_name: `${name} (Propietario)`,
            },
          ]),
        )
        .catch((err) => {
          if (__DEV__) console.error('[Auth] Background setup failed', err);
        });
    } catch (err) {
      try {
        await client.auth.signOut();
      } catch (_) {
        // Ignore signOut errors during cleanup
      }
      throw err;
    } finally {
      clearTimeout(usernameTimeoutId);
    }
  };

  const submit = async () => {
    if (!canSubmit || loading) return;

    setLoading(true);

    try {
      if (isSignIn) {
        await submitSignIn();
      } else {
        await submitSignUp();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.errors.accountCreationFailed');
      toast.showError({ title: msg });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    if (!allowSignUp) return;
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
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
      colors={[STOCKY_COLORS.primary900, STOCKY_COLORS.primary700, STOCKY_COLORS.accent500]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />

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
            <StockyToast
              visible={toast.toast.visible}
              type={toast.toast.type}
              title={toast.toast.title}
              message={toast.toast.message}
              ctaText={toast.toast.ctaText}
              durationMs={toast.toast.durationMs}
              onClose={toast.hideToast}
            />

            <View style={cardStyle}>
              <View style={styles.languageSwitchContainer}>
                <LanguageSwitch />
              </View>

              <LinearGradient
                colors={[STOCKY_COLORS.primary700, STOCKY_COLORS.accent500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoBox}
              >
                <Ionicons
                  name={isSignIn ? 'storefront-outline' : 'business-outline'}
                  size={36}
                  color="#FFFFFF"
                />
              </LinearGradient>

              <Text style={styles.title}>{isSignIn ? t('auth.login') : t('auth.register')}</Text>

              <Text style={styles.subtitle}>
                {isSignIn ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
              </Text>

              {isSignIn ? (
                <>
                  <Pressable
                    onPress={() => Linking.openURL('https://www.stockypos.app')}
                    style={styles.registerPromptWrap}
                  >
                    <Text style={styles.registerPromptText}>{t('auth.registerPrompt')}</Text>
                  </Pressable>
                  <View style={styles.separator} />
                </>
              ) : null}

              <View>
                {isSignIn ? (
                  <>
                    <AuthInput
                      label={t('auth.username')}
                      value={signInForm.username}
                      onChangeText={(next) =>
                        setSignInForm((prev) => ({ ...prev, username: next }))
                      }
                      placeholder={t('auth.usernamePlaceholder')}
                      icon="person-outline"
                      autoCapitalize="none"
                    />

                    <AuthInput
                      label={t('auth.password')}
                      value={signInForm.password}
                      onChangeText={(next) =>
                        setSignInForm((prev) => ({ ...prev, password: next }))
                      }
                      placeholder={t('auth.passwordPlaceholder')}
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
                      label={t('auth.businessName')}
                      value={signUpForm.name}
                      onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, name: next }))}
                      placeholder={t('auth.businessNamePlaceholder')}
                      icon="storefront-outline"
                      autoCapitalize="words"
                    />

                    <AuthInput
                      label={t('auth.username')}
                      value={signUpForm.username}
                      onChangeText={(next) =>
                        setSignUpForm((prev) => ({ ...prev, username: next }))
                      }
                      placeholder={t('auth.usernamePlaceholder')}
                      icon="person-outline"
                      autoCapitalize="none"
                    />

                    <AuthInput
                      label={t('auth.nitOptional')}
                      value={signUpForm.nit}
                      onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, nit: next }))}
                      placeholder="900.123.456-7"
                      icon="business-outline"
                    />

                    <AuthInput
                      label={t('auth.phone')}
                      value={signUpForm.phone}
                      onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, phone: next }))}
                      placeholder="+57 300 123 4567"
                      icon="call-outline"
                      keyboardType="phone-pad"
                    />

                    <AuthInput
                      label={t('auth.address')}
                      value={signUpForm.address}
                      onChangeText={(next) => setSignUpForm((prev) => ({ ...prev, address: next }))}
                      placeholder={t('auth.addressPlaceholder')}
                      icon="location-outline"
                      autoCapitalize="words"
                    />

                    <AuthInput
                      label={t('auth.password')}
                      value={signUpForm.password}
                      onChangeText={(next) =>
                        setSignUpForm((prev) => ({ ...prev, password: next }))
                      }
                      placeholder={t('auth.passwordPlaceholder')}
                      icon="lock-closed-outline"
                      secure
                      showToggle
                      isVisible={showSignUpPassword}
                      onToggleVisibility={() => setShowSignUpPassword((prev) => !prev)}
                    />

                    <AuthInput
                      label={t('auth.confirmPassword')}
                      value={signUpForm.confirmPassword}
                      onChangeText={(next) =>
                        setSignUpForm((prev) => ({
                          ...prev,
                          confirmPassword: next,
                        }))
                      }
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      icon="lock-closed-outline"
                      secure
                      showToggle
                      isVisible={showSignUpConfirmPassword}
                      onToggleVisibility={() => setShowSignUpConfirmPassword((prev) => !prev)}
                    />
                  </>
                )}
              </View>

              <View>
                <Pressable
                  onPress={submit}
                  disabled={!canSubmit || loading}
                  style={styles.submitWrap}
                >
                  <LinearGradient
                    colors={
                      !canSubmit || loading
                        ? [STOCKY_COLORS.accent300, STOCKY_COLORS.backgroundBase]
                        : [STOCKY_COLORS.primary900, STOCKY_COLORS.primary700]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitButton}
                  >
                    {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
                    <Text style={styles.submitText}>
                      {isSignIn ? t('buttons.signIn') : t('buttons.signUp')}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>

              <View>
                {!allowSignUp ? (
                  <Pressable
                    onPress={() => Linking.openURL('https://wa.me/573188246925')}
                    style={styles.signInHelperWrap}
                  >
                    <Text style={styles.signInHelper}>{t('auth.supportMessage')}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchPrompt}>
                      {isSignIn ? t('auth.noAccount') : t('auth.hasAccount')}
                    </Text>
                    <Pressable onPress={switchMode}>
                      <Text style={styles.switchAction}>
                        {isSignIn ? t('auth.registerBusiness') : t('auth.signIn')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
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
  blob1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -60,
    right: -80,
    backgroundColor: 'rgba(102, 165, 173, 0.18)',
  },
  blob2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -40,
    left: -60,
    backgroundColor: 'rgba(153, 211, 219, 0.15)',
  },
  blob3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: '40%',
    right: -40,
    backgroundColor: 'rgba(0, 59, 70, 0.12)',
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
    borderRadius: STOCKY_RADIUS.xl,
    backgroundColor: STOCKY_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: STOCKY_COLORS.primary900,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  cardSignUp: {
    justifyContent: 'flex-start',
  },
  languageSwitchContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: STOCKY_COLORS.primary700,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    textAlign: 'center',
    color: STOCKY_COLORS.primary900,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'center',
    color: STOCKY_COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  registerPromptWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(7, 87, 91, 0.14)',
    backgroundColor: 'rgba(7, 87, 91, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  registerPromptText: {
    textAlign: 'center',
    color: STOCKY_COLORS.primary700,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: STOCKY_COLORS.borderSoft,
    marginVertical: 8,
    width: '35%',
    alignSelf: 'center',
  },
  inputGroup: {
    gap: 5,
    marginTop: 6,
  },
  inputLabel: {
    color: STOCKY_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: STOCKY_RADIUS.md,
    borderWidth: 1.5,
    borderColor: STOCKY_COLORS.borderSoft,
    backgroundColor: STOCKY_COLORS.surface,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: STOCKY_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 6,
  },
  submitWrap: {
    marginTop: 14,
  },
  submitButton: {
    minHeight: 44,
    borderRadius: STOCKY_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: STOCKY_COLORS.primary900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  switchPrompt: {
    color: STOCKY_COLORS.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  switchAction: {
    color: STOCKY_COLORS.primary700,
    fontSize: 15,
    fontWeight: '700',
  },
  signInHelperWrap: {
    marginTop: 10,
  },
  signInHelper: {
    textAlign: 'center',
    color: STOCKY_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
