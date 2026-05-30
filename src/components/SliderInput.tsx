import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
  suffix?: string;
  textValue?: string;
  onTextChange?: (text: string) => void;
}

export default function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onValueChange,
  formatValue,
  suffix,
  textValue,
  onTextChange,
}: SliderInputProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {onTextChange ? (
          <View style={styles.valueInputRow}>
            <TextInput
              style={styles.valueInput}
              value={textValue ?? value.toString()}
              onChangeText={onTextChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            {suffix && <Text style={styles.suffix}>{suffix}</Text>}
          </View>
        ) : (
          <Text style={styles.value}>
            {displayValue}{suffix ? suffix : ''}
          </Text>
        )}
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onValueChange={onValueChange}
        minimumTrackTintColor={Colors.accent}
        maximumTrackTintColor={Colors.border}
        thumbTintColor={Colors.accent}
      />
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{formatValue ? formatValue(min) : min}</Text>
        <Text style={styles.rangeText}>{formatValue ? formatValue(max) : max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  valueInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueInput: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '700',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minWidth: 80,
    textAlign: 'right',
  },
  suffix: {
    color: Colors.textTertiary,
    fontSize: FontSizes.sm,
    marginLeft: 4,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  rangeText: {
    color: Colors.textTertiary,
    fontSize: FontSizes.xs,
  },
});
