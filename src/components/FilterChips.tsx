import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';

interface FilterChipsSingleProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  multiSelect?: false;
}

interface FilterChipsMultiProps {
  options: string[];
  selectedMulti: string[];
  onSelectMulti: (options: string[]) => void;
  multiSelect: true;
}

type FilterChipsProps = FilterChipsSingleProps | FilterChipsMultiProps;

export default function FilterChips(props: FilterChipsProps) {
  const { options } = props;

  if (props.multiSelect) {
    const { selectedMulti, onSelectMulti } = props;
    const allSelected = selectedMulti.length === 0 || selectedMulti.includes('All');

    const handleMultiTap = (option: string) => {
      if (option === 'All') {
        onSelectMulti([]);
        return;
      }
      const nonAllOptions = options.filter(o => o !== 'All');
      if (allSelected) {
        // Switching from "All" to a specific selection
        onSelectMulti([option]);
      } else if (selectedMulti.includes(option)) {
        const next = selectedMulti.filter(o => o !== option);
        // If nothing left, revert to All
        onSelectMulti(next.length === 0 ? [] : next);
      } else {
        const next = [...selectedMulti, option];
        // If all non-All options selected, revert to All
        if (next.length >= nonAllOptions.length) {
          onSelectMulti([]);
        } else {
          onSelectMulti(next);
        }
      }
    };

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {options.map((option) => {
          const isActive = option === 'All' ? allSelected : selectedMulti.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handleMultiTap(option)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  // Single-select mode (original behavior)
  const { selected, onSelect } = props;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.tileBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
