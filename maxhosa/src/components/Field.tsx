import { StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { Text } from './Text';

/** An inline error that is announced as it appears and never relies on colour alone. */
export function ErrorText({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.error} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={15} color={colors.rust} />
      <Text variant="footnote" color="rust" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** A labelled text field with its error beneath it. */
export function Input({
  label,
  value,
  error,
  onChange,
  onBlur,
  multiline,
  autoComplete,
  keyboardType,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  multiline?: boolean;
  autoComplete?: 'name' | 'email' | 'tel';
  keyboardType?: 'email-address' | 'phone-pad';
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="footnote" weight="700" color="ink2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        multiline={multiline}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoCapitalize={autoComplete === 'email' ? 'none' : 'sentences'}
        accessibilityLabel={label}
        accessibilityHint={error}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top' },
          {
            backgroundColor: colors.sunk,
            color: colors.ink,
            borderColor: error ? colors.rust : 'transparent',
          },
        ]}
      />
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: space.m,
    fontSize: 16,
    borderWidth: 2,
  },
  error: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
});
