import { Text, StyleSheet } from 'react-native'
import { AUTH_ERROR } from './AuthInput'

/** Small red inline message under a field (renders nothing without text). */
export default function FieldHint({ text }: { text?: string | false | null }) {
  if (!text) return null
  return <Text style={styles.hint}>{text}</Text>
}

const styles = StyleSheet.create({
  hint: {
    color: AUTH_ERROR,
    fontSize: 12,
    marginTop: -6,
    marginLeft: 6,
  },
})
