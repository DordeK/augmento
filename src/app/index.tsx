import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>AUGMENTO</Text>
      <Text style={styles.title}>Creator sponsorships, made native.</Text>
      <Text style={styles.subtitle}>
        Your Expo SDK 54 mobile app is ready for the hackathon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#0B1020',
  },
  eyebrow: {
    marginBottom: 16,
    color: '#68D5C8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    maxWidth: 340,
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 43,
  },
  subtitle: {
    maxWidth: 340,
    marginTop: 18,
    color: '#AAB4CF',
    fontSize: 17,
    lineHeight: 25,
  },
});
