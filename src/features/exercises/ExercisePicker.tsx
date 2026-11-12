import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { filterExercises, type CatalogExercise } from '@/domain/exercises/catalog';
import { listExercises } from '@/services/exercises/exercise-data';
import { colors, borderRadius } from '@/theme/colors';

export function ExercisePicker({ onChoose, onClose, busy, allowedPatterns }: { onChoose: (item: CatalogExercise) => void; onClose: () => void; busy: boolean; allowedPatterns?: string[] }) {
  const [items, setItems] = useState<CatalogExercise[]>([]);
  const [query, setQuery] = useState(''); const [tag, setTag] = useState('');
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError(null);
    try { setItems(await listExercises()); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const visibleItems = filterExercises(items, query, tag).filter((item) => !allowedPatterns || item.patterns.some((pattern) => allowedPatterns.includes(pattern)));
  return <View style={{ gap: 8, padding: 12, backgroundColor: colors.card, borderRadius: borderRadius.sm }}>
    <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Elegir ejercicio de la biblioteca</Text>
    <TextInput accessibilityLabel="Buscar ejercicio" placeholder="Buscar por nombre" value={query} onChangeText={setQuery} style={{ borderWidth: 1, borderColor: colors.border, padding: 8 }} />
    <TextInput accessibilityLabel="Filtrar ejercicios por etiqueta" placeholder="Filtrar por etiqueta" value={tag} onChangeText={setTag} style={{ borderWidth: 1, borderColor: colors.border, padding: 8 }} />
    {loading ? <ActivityIndicator /> : null}
    {error ? <><Text style={{ color: colors.error }}>{error}</Text><Pressable onPress={() => void load()}><Text>Reintentar</Text></Pressable></> : null}
    {!loading && !error && !visibleItems.length ? <Text>No hay ejercicios disponibles.</Text> : null}
    {visibleItems.map(item => <Pressable key={item.id} disabled={busy} accessibilityRole="button" onPress={() => onChoose(item)} style={{ paddingVertical: 8 }}><Text style={{ color: colors.brand, fontWeight: '700' }}>{item.name}</Text><Text>{item.patterns.join(' · ')}</Text></Pressable>)}
    <Pressable disabled={busy} onPress={onClose}><Text style={{ color: colors.brand }}>Cerrar</Text></Pressable>
  </View>;
}
