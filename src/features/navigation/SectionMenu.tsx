import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/services/supabase/session';

const sections: { label: string; route: Href }[] = [
  { label: 'Clientes', route: '/' as Href },
  { label: 'Ejercicios', route: '/exercises' as Href },
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
  trigger: { borderWidth: 1, borderColor: '#b7cbc2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  triggerText: { color: '#436b63', fontSize: 16, fontWeight: '700' },
  menu: { position: 'absolute', top: 46, right: 0, minWidth: 170, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e3de', borderRadius: 8, padding: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  item: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 5 },
  selected: { backgroundColor: '#e7f1ec' },
  signOut: { borderTopWidth: 1, borderColor: '#d9e3de', marginTop: 4, paddingHorizontal: 12, paddingVertical: 12 },
  error: { color: '#a43d3d', paddingHorizontal: 12, paddingBottom: 8 },
  itemText: { color: '#182321', fontSize: 16 },
  selectedText: { color: '#436b63', fontWeight: '700' },
});
