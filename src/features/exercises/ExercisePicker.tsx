import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { filterExercises, type CatalogExercise } from '@/domain/exercises/catalog';
import { listExercises } from '@/services/exercises/exercise-data';

export function ExercisePicker({ onChoose, onClose, busy }: { onChoose: (item: CatalogExercise) => void; onClose: () => void; busy: boolean }) {
  const [items, setItems] = useState<CatalogExercise[]>([]);
  const [query, setQuery] = useState(''); const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError(null);
    try { setItems(await listExercises()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <View style={{ gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8 }}>
    <Text style={{ fontWeight: '700' }}>Elegir ejercicio de la biblioteca</Text>
    <TextInput accessibilityLabel="Buscar ejercicio" placeholder="Buscar por nombre" value={query} onChangeText={setQuery} style={{ borderWidth: 1, borderColor: '#ccd6d1', padding: 8 }} />
    <TextInput accessibilityLabel="Filtrar ejercicios por etiqueta" placeholder="Filtrar por etiqueta" value={tag} onChangeText={setTag} style={{ borderWidth: 1, borderColor: '#ccd6d1', padding: 8 }} />
    {loading ? <ActivityIndicator /> : null}
    {error ? <><Text style={{ color: '#a43d3d' }}>{error}</Text><Pressable onPress={() => void load()}><Text>Reintentar</Text></Pressable></> : null}
    {!loading && !error && !filterExercises(items, query, tag).length ? <Text>No hay ejercicios disponibles.</Text> : null}
    {filterExercises(items, query, tag).map(item => <Pressable key={item.id} disabled={busy} accessibilityRole="button" onPress={() => onChoose(item)} style={{ paddingVertical: 8 }}><Text style={{ color: '#436b63', fontWeight: '700' }}>{item.name}</Text><Text>{item.patterns.join(' · ')}</Text></Pressable>)}
    <Pressable disabled={busy} onPress={onClose}><Text style={{ color: '#436b63' }}>Cerrar</Text></Pressable>
  </View>;
}
