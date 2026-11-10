import { useEffect, useState } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionMenu } from '@/features/navigation/SectionMenu';
import { listClients, type ClientListItem } from '@/services/clients-integration/client-data';

export default function ClientsScreen() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(offset: number) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listClients(50, offset);
      setClients((current) => offset === 0 ? page.clients : [...current, ...page.clients]);
      setNextOffset(page.next_offset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(0); }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BEAMOTION</Text>
          <Text style={styles.title}>Clientas</Text>
        </View>
        <SectionMenu current="Clientes" />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/client/${item.id}` as Href)}
            style={styles.row}
          >
            <Text style={styles.name}>{item.nombre}</Text>
            <View style={styles.rowDetails}>
              <Text style={item.has_active_bono ? styles.bonoActive : styles.secondary}>
                {item.has_active_bono ? 'Bono vigente' : 'Sin bono vigente'}
              </Text>
              <Text style={styles.secondary}>{item.active ? 'Perfil activo' : 'Perfil inactivo'}  ›</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.secondary}>No hay clientas disponibles.</Text> : undefined}
        ListFooterComponent={
          loading ? <ActivityIndicator style={styles.footer} /> : nextOffset !== null && clients.length > 0
            ? <Pressable onPress={() => void load(nextOffset)} style={styles.more}><Text style={styles.link}>Cargar más</Text></Pressable>
            : undefined
        }
        refreshing={loading && clients.length > 0}
        onRefresh={() => void load(0)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  header: { padding: 24, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  eyebrow: { color: '#436b63', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#182321', fontSize: 30, fontWeight: '700', marginTop: 6 },
  link: { color: '#436b63', fontSize: 16, fontWeight: '700' },
  error: { color: '#a43d3d', marginHorizontal: 24, marginBottom: 12 },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  row: { backgroundColor: '#fff', padding: 18, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#182321', fontSize: 17, fontWeight: '600', flex: 1 },
  rowDetails: { alignItems: 'flex-end', gap: 4 },
  bonoActive: { color: '#436b63', fontSize: 14, fontWeight: '700' },
  secondary: { color: '#53615e', fontSize: 14 },
  footer: { margin: 20 },
  more: { padding: 18, alignItems: 'center' },
});
