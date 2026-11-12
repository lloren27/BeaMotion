import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/services/supabase/session';
import { colors, borderRadius, spacing } from '@/theme/colors';

const sections: { label: string; route: Href }[] = [
  { label: 'Clientes', route: '/' as Href },
  { label: 'Ejercicios', route: '/exercises' as Href },
  { label: 'Modelos mensuales', route: '/training-models' as Href },
];

export function SectionMenu({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useSession();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menú de navegación"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={styles.trigger}
      >
        <Text style={styles.triggerText}>☰  Menú</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {sections.map((section) => {
            const selected = section.label === current;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={section.label}
                onPress={() => {
                  setOpen(false);
                  if (!selected) router.replace(section.route);
                }}
                style={[styles.item, selected && styles.selected]}
              >
                <Text style={[styles.itemText, selected && styles.selectedText]}>{section.label}</Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" style={styles.signOut} onPress={() => {
            setError(null);
            void signOut().catch(() => setError('No se pudo cerrar la sesión. Inténtalo de nuevo.'));
          }}>
            <Text style={styles.itemText}>Cerrar sesión</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignItems: 'flex-end', zIndex: 10 },
  trigger: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  triggerText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  menu: { position: 'absolute', top: 46, right: 0, minWidth: 170, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight, borderRadius: borderRadius.sm, padding: spacing.xs, shadowColor: colors.shadow, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  item: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: spacing.xs },
  selected: { backgroundColor: colors.muted },
  signOut: { borderTopWidth: 1, borderColor: colors.borderLight, marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  error: { color: colors.error, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  itemText: { color: colors.textPrimary, fontSize: 16 },
  selectedText: { color: colors.brand, fontWeight: '700' },
});
