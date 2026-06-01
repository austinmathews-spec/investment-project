import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../theme';
import { formatDateLong } from '../utils/format';

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
}

export default function DatePickerField({ label, value, onChange }: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayValue = value ? formatDateLong(value) : 'Select a date';

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.webInputWrap}>
          <Feather name="calendar" size={16} color={Colors.accent} style={{ marginRight: Spacing.sm }} />
          <input
            type="date"
            value={value}
            onChange={(e: any) => onChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: Colors.textPrimary,
              fontSize: 15,
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </View>
      </View>
    );
  }

  // Native fallback: show formatted date with a simple month/year picker
  const [tempYear, setTempYear] = useState(value ? new Date(value).getFullYear() : new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(value ? new Date(value).getMonth() : new Date().getMonth());
  const [tempDay, setTempDay] = useState(value ? new Date(value).getDate() : new Date().getDate());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const confirmDate = () => {
    const mm = String(tempMonth + 1).padStart(2, '0');
    const dd = String(Math.min(tempDay, daysInMonth)).padStart(2, '0');
    onChange(`${tempYear}-${mm}-${dd}`);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
        <Feather name="calendar" size={16} color={Colors.accent} />
        <Text style={styles.pickerText}>{displayValue}</Text>
        <Feather name="chevron-down" size={14} color={Colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.calendarCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={confirmDate}>
                <Text style={styles.calendarDone}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Year */}
            <View style={styles.calendarRow}>
              <TouchableOpacity onPress={() => setTempYear(y => y - 1)}>
                <Feather name="chevron-left" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.calendarYearText}>{tempYear}</Text>
              <TouchableOpacity onPress={() => setTempYear(y => y + 1)}>
                <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Months */}
            <View style={styles.monthGrid}>
              {months.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthCell, tempMonth === i && styles.monthCellActive]}
                  onPress={() => setTempMonth(i)}
                >
                  <Text style={[styles.monthText, tempMonth === i && styles.monthTextActive]}>
                    {m.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Days */}
            <View style={styles.dayGrid}>
              {days.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayCell, tempDay === d && styles.dayCellActive]}
                  onPress={() => setTempDay(d)}
                >
                  <Text style={[styles.dayText, tempDay === d && styles.dayTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  webInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  pickerText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModal: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: 320,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  calendarCancel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  calendarTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  calendarDone: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  calendarYearText: {
    color: Colors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  monthCell: {
    width: '23%',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  monthCellActive: {
    backgroundColor: Colors.accentDim,
  },
  monthText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  monthTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellActive: {
    backgroundColor: Colors.accent,
  },
  dayText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  dayTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
