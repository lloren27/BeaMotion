import { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchAllClientPages } from '@/domain/rules/client-search';
import { SectionMenu } from '@/features/navigation/SectionMenu';
import { listClients, type ClientListItem } from '@/services/clients-integration/client-data';

export default function ClientsScreen() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const loadingMore = useRef(false);

  async function load(offset: number, term: string, version: number) {
    if (offset > 0 && loadingMore.current) return;
    if (offset > 0) loadingMore.current = true;
    setLoading(true);
    setError(null);
    try {
      if (term.trim()) {
        const matches = await searchAllClientPages((pageOffset) => listClients(50, pageOffset), term, () => version === requestVersion.current);
        if (version !== requestVersion.current) return;
        setClients(matches);
        setNextOffset(null);
      } else {
        const page = await listClients(50, offset);
        if (version !== requestVersion.current) return;
        setClients((current) => offset === 0 ? page.clients : [...current, ...page.clients]);
        setNextOffset(page.next_offset);
      }
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista.');
    } finally {
      if (offset > 0) loadingMore.current = false;
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    const version = ++requestVersion.current;
    setClients([]);
    setNextOffset(null);
    setLoading(true);
    const timer = setTimeout(() => void load(0, query, version), query.trim() ? 300 : 0);
    return () => { clearTimeout(timer); ++requestVersion.current; };
  }, [query]);

  function refresh() {
    const version = ++requestVersion.current;
    void load(0, query, version);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BEAMOTION</Text>
          <Text style={styles.title}>Clientas</Text>
        </View>
        <SectionMenu current="Clientes" />
      </View>
      <TextInput
        accessibilityLabel="Buscar clientes por nombre o apellidos"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={(value) => { ++requestVersion.current; setQuery(value); }}
        placeholder="Buscar por nombre o apellidos"
        style={styles.search}
        value={query}
      />
      {error ? <View><Text style={styles.error}>{error}</Text><Pressable onPress={refresh}><Text style={[styles.link, styles.retry]}>Reintentar</Text></Pressable></View> : null}
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
        ListEmptyComponent={!loading && !error ? <Text style={styles.secondary}>{query.trim() ? 'No se encontraron clientes.' : 'No hay clientas disponibles.'}</Text> : undefined}
        ListFooterComponent={
          loading ? <ActivityIndicator style={styles.footer} /> : nextOffset !== null && clients.length > 0
            ? <Pressable onPress={() => void load(nextOffset, query, requestVersion.current)} style={styles.more}><Text style={styles.link}>Cargar más</Text></Pressable>
            : undefined
        }
        refreshing={loading && clients.length > 0}
        onRefresh={refresh}
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
  retry: { marginHorizontal: 24, marginBottom: 12 },
  search: { marginHorizontal: 24, marginBottom: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccd6d1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  row: { backgroundColor: '#fff', padding: 18, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#182321', fontSize: 17, fontWeight: '600', flex: 1 },
  rowDetails: { alignItems: 'flex-end', gap: 4 },
  bonoActive: { color: '#436b63', fontSize: 14, fontWeight: '700' },
  secondary: { color: '#53615e', fontSize: 14 },
  footer: { margin: 20 },
  more: { padding: 18, alignItems: 'center' },
});
