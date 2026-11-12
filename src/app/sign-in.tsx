import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '@/services/supabase/session';
import { colors, borderRadius, spacing } from '@/theme/colors';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('No se pudo iniciar sesión. Comprueba el correo y la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>BEAMOTION</Text>
        <Text style={styles.title}>Acceso al panel</Text>
        <Text style={styles.description}>Entra con tu cuenta de Lovable. Los entrenamientos requieren además una cuenta en el Supabase de BeaMotion.</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoComplete="current-password"
          onChangeText={setPassword}
          onSubmitEditing={submit}
          placeholder="Contraseña"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy || !email.trim() || !password} onPress={submit} style={styles.button}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.surface },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: spacing.md },
  eyebrow: { color: colors.accentDark, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.textPrimary, fontSize: 30, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 16 },
  error: { color: colors.error, fontSize: 14 },
  button: { backgroundColor: colors.brand, borderRadius: borderRadius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
