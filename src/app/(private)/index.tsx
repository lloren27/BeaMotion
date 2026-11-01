import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>BEAMOTION</Text>
      <Text style={styles.title}>Gestión de entrenamientos</Text>
      <Text style={styles.description}>
        La base de la aplicación está lista. La autenticación y la conexión con
        los datos se configurarán después de revisar el backend de Lovable.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#f7f8fa',
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  eyebrow: {
    color: '#436b63',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    color: '#182321',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: '#53615e',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 560,
  },
});
