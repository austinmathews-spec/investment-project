import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, FontSizes, Spacing, BorderRadius, useTheme } from '../theme';

interface InputFieldProps extends TextInputProps {
  label: string;
  suffix?: string;
}

export default function InputField({ label, suffix, style, ...props }: InputFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }, style]}
          placeholderTextColor={colors.textTertiary}
          {...props}
        />
        {suffix && <Text style={[styles.suffix, { color: colors.textSecondary }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  suffix: {
    fontSize: FontSizes.sm,
    marginLeft: Spacing.sm,
  },
});
