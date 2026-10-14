import { Linking, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants'
import { PRIVACY_URL, TERMS_URL } from '../../lib/authConfig'

/** Card heading + supporting line. */
export function CardHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

/** Terms / privacy note with tappable links. */
export function LegalNote() {
  return (
    <Text style={styles.legal}>
      By continuing you agree to Aurora&apos;s{' '}
      <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>
        Terms
      </Text>{' '}
      and{' '}
      <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
        Privacy Policy
      </Text>
      .
    </Text>
  )
}

export const authText = StyleSheet.create({
  emphasis: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  linkMuted: {
    color: 'rgba(245,240,235,0.62)',
    fontSize: 13,
    fontWeight: '600',
  },
  linkAccent: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  linkDisabled: {
    color: 'rgba(245,240,235,0.38)',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
})

const styles = StyleSheet.create({
  heading: {
    gap: 6,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: 'rgba(245,240,235,0.62)',
    fontSize: 14,
    lineHeight: 20,
  },
  legal: {
    color: 'rgba(245,240,235,0.42)',
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: {
    color: 'rgba(245,240,235,0.72)',
    textDecorationLine: 'underline',
  },
})
