import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMadridDate } from '@/domain/rules/training-plan';
import { SectionMenu } from '@/features/navigation/SectionMenu';
import { listTodayTrainingClients, type TodayTrainingClient } from '@/services/clients-integration/today-training-data';
import { colors, borderRadius, spacing } from '@/theme/colors';

const timeFormat = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

export default function TodayScreen() {
  const [date, setDate] = useState(getMadridDate);
  const [clients, setClients] = useState<TodayTrainingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const loadedDate = useRef(date);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const today = getMadridDate();
    loadedDate.current = today;
    setDate(today);
    setClients([]);
    setLoading(true);
    setError(null);
    try {
      const result = await listTodayTrainingClients(today);
      if (version === requestVersion.current) setClients(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los entrenamientos.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (getMadridDate() !== loadedDate.current) void refresh();
    }, 1000);
    return () => { ++requestVersion.current; subscription.remove(); clearInterval(timer); };
  }, [refresh]));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>BEAMOTION</Text>
          <Text style={styles.title}>Entrenamientos de hoy</Text>
          <Text style={styles.date}>{dayFormat.format(new Date(`${date}T12:00:00Z`))}</Text>
        </View>
        <SectionMenu current="Hoy" />
      </View>
      {!loading && !error ? <Text style={styles.count}>{clients.length} {clients.length === 1 ? 'cliente con reserva' : 'clientes con reserva'}</Text> : null}
      {error ? <View style={styles.message}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>Reintentar</Text></Pressable></View> : null}
      <FlatList
        data={clients}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver entrenamientos de ${item.name} del ${date}`}
            onPress={() => router.push({ pathname: '/client/[id]', params: { id: item.clientId, date } } as Href)}
            style={styles.row}
          >
            <View style={styles.details}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.times}>{item.startsAt.map((value) => timeFormat.format(new Date(value))).join(' · ')}</Text>
            </View>
            <Text style={styles.link}>Ver entreno ›</Text>
          </Pressable>
        )}
        ListEmptyComponent={!loading && !error ? <Text style={styles.secondary}>No hay clientes con reserva para hoy.</Text> : undefined}
        ListFooterComponent={loading ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : undefined}
        refreshing={loading}
        onRefresh={() => void refresh()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.xxl, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, zIndex: 10 },
  heading: { flex: 1 },
  eyebrow: { color: colors.accentDark, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '700', marginTop: spacing.xs },
  date: { color: colors.textSecondary, fontSize: 16, marginTop: spacing.sm },
  count: { color: colors.textSecondary, marginHorizontal: spacing.xxl, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.xxl, paddingBottom: 32 },
  row: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  details: { flex: 1, minWidth: 140, gap: spacing.sm },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  times: { color: colors.brand, fontSize: 17, fontWeight: '700' },
  secondary: { color: colors.textSecondary, fontSize: 16 },
  link: { color: colors.brand, fontSize: 15, fontWeight: '700', paddingVertical: spacing.sm },
  message: { marginHorizontal: spacing.xxl, marginBottom: spacing.md },
  error: { color: colors.error },
  footer: { margin: spacing.xl },
});
