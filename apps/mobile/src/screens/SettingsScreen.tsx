import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { Stepper } from '@/components/Stepper';
import { usePresetStore } from '@/stores/presetStore';
import { useUsageStore } from '@/stores/usageStore';
import { requestUsageAccess } from '@/native/UsageStats';
import type { Preset, TimerDisplayMode } from '@/types';
import { triggerHaptic } from '@/utils/haptics';

const CLASSIC_ID = 'classic';

const formatPresetSummary = (preset: Preset): string => {
  return `${preset.workMinutes}/${preset.shortBreakMinutes}/${preset.longBreakMinutes} \u00b7 ${preset.cyclesBeforeLongBreak} cycles`;
};

const SettingsScreen = () => {
  const presets = usePresetStore((s) => s.presets);
  const activePresetId = usePresetStore((s) => s.activePresetId);
  const dailyGoal = usePresetStore((s) => s.dailyGoal);
  const vibrationEnabled = usePresetStore((s) => s.vibrationEnabled);
  const timerDisplayMode = usePresetStore((s) => s.timerDisplayMode);
  const addPreset = usePresetStore((s) => s.addPreset);
  const updatePreset = usePresetStore((s) => s.updatePreset);
  const deletePreset = usePresetStore((s) => s.deletePreset);
  const setActivePreset = usePresetStore((s) => s.setActivePreset);
  const setDailyGoal = usePresetStore((s) => s.setDailyGoal);
  const setVibrationEnabled = usePresetStore((s) => s.setVibrationEnabled);
  const setTimerDisplayMode = usePresetStore((s) => s.setTimerDisplayMode);
  const usageAccessGranted = useUsageStore((s) => s.usageAccessGranted);
  const trackedApps = useUsageStore((s) => s.trackedApps);
  const toggleApp = useUsageStore((s) => s.toggleApp);
  const checkUsagePermission = useUsageStore((s) => s.checkPermission);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTrackedApps, setShowTrackedApps] = useState(false);

  const handlePresetTap = useCallback(
    (id: string) => {
      triggerHaptic();
      setActivePreset(id);
      setEditingId((current) => (current === id ? null : id));
    },
    [setActivePreset],
  );

  const handlePresetLongPress = useCallback(
    (id: string) => {
      if (id === CLASSIC_ID) {
        return;
      }
      Alert.alert('delete preset?', '', [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'delete',
          style: 'destructive',
          onPress: () => {
            if (editingId === id) {
              setEditingId(null);
            }
            deletePreset(id);
          },
        },
      ]);
    },
    [deletePreset, editingId],
  );

  const handleAddPreset = useCallback(() => {
    triggerHaptic();
    if (presets.length >= 5) {
      return;
    }
    addPreset({
      name: 'new preset',
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    });
    // The new preset will be the last one; set it as editing
    // We need to get the updated presets after addPreset
    // Since zustand updates synchronously, we can access via getState
    const updated = usePresetStore.getState().presets;
    const newest = updated[updated.length - 1];
    if (newest) {
      setActivePreset(newest.id);
      setEditingId(newest.id);
    }
  }, [presets.length, addPreset, setActivePreset]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <Text style={styles.heading}>settings</Text>

      <Text style={styles.sectionHeader}>presets</Text>

      {presets.map((preset) => (
        <View key={preset.id}>
          <Pressable
            onPress={() => handlePresetTap(preset.id)}
            onLongPress={() => handlePresetLongPress(preset.id)}
            style={({ pressed }) => [
              styles.presetRow,
              pressed && styles.pressed,
            ]}>
            <View style={styles.presetInfo}>
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetSummary}>
                {formatPresetSummary(preset)}
              </Text>
            </View>
            {preset.id === activePresetId ? (
              <Text style={styles.checkmark}>{'\u2713'}</Text>
            ) : null}
          </Pressable>

          {editingId === preset.id ? (
            <PresetEditor preset={preset} onUpdate={updatePreset} />
          ) : null}
        </View>
      ))}

      {presets.length < 5 ? (
        <Pressable
          onPress={handleAddPreset}
          style={({ pressed }) => [
            styles.addPresetButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.addPresetText}>+ add preset</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionHeader}>daily goal</Text>
      <Stepper
        value={dailyGoal}
        onValueChange={setDailyGoal}
        min={1}
        max={12}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>vibration</Text>
        <Switch
          value={vibrationEnabled}
          onValueChange={setVibrationEnabled}
          trackColor={{
            false: colors.background_elevated,
            true: colors.text_muted,
          }}
          thumbColor={
            vibrationEnabled ? colors.text_primary : colors.text_muted
          }
        />
      </View>

      <Text style={styles.sectionHeader}>distraction tracking</Text>
      {!usageAccessGranted ? (
        <Pressable
          onPress={() => {
            triggerHaptic();
            requestUsageAccess().then(() => {
              // Re-check after user returns
              checkUsagePermission();
            });
          }}
          style={({ pressed }) => [
            styles.displayOption,
            pressed && styles.pressed,
          ]}>
          <View style={styles.presetInfo}>
            <Text style={styles.presetName}>grant usage access</Text>
            <Text style={styles.presetSummary}>
              shows time on distraction apps
            </Text>
          </View>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={() => { triggerHaptic(); setShowTrackedApps((v) => !v); }}
            style={({ pressed }) => [
              styles.displayOption,
              pressed && styles.pressed,
            ]}>
            <View style={styles.presetInfo}>
              <Text style={styles.presetName}>manage tracked apps</Text>
              <Text style={styles.presetSummary}>
                tracking {trackedApps.filter((a) => a.enabled).length} apps
              </Text>
            </View>
          </Pressable>
          {showTrackedApps && (
            <View style={styles.editorContainer}>
              {trackedApps.map((app) => (
                <View key={app.packageName} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{app.label}</Text>
                  <Switch
                    value={app.enabled}
                    onValueChange={() => toggleApp(app.packageName)}
                    trackColor={{
                      false: colors.background_elevated,
                      true: colors.text_muted,
                    }}
                    thumbColor={
                      app.enabled ? colors.text_primary : colors.text_muted
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Text style={styles.sectionHeader}>timer display</Text>
      <Pressable
        onPress={() => { triggerHaptic(); setTimerDisplayMode('digital'); }}
        style={({ pressed }) => [
          styles.displayOption,
          pressed && styles.pressed,
        ]}>
        <View style={styles.presetInfo}>
          <Text style={styles.presetName}>digital</Text>
          <Text style={styles.presetSummary}>large countdown</Text>
        </View>
        {timerDisplayMode === 'digital' ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => { triggerHaptic(); setTimerDisplayMode('blocks'); }}
        style={({ pressed }) => [
          styles.displayOption,
          pressed && styles.pressed,
        ]}>
        <View style={styles.presetInfo}>
          <Text style={styles.presetName}>blocks</Text>
          <Text style={styles.presetSummary}>circular ring</Text>
        </View>
        {timerDisplayMode === 'blocks' ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : null}
      </Pressable>

      <Text style={styles.sectionHeader}>about</Text>
      <Text style={styles.aboutText}>foxhole v1.0.0</Text>
    </ScrollView>
  );
};

interface PresetEditorProps {
  preset: Preset;
  onUpdate: (id: string, updates: Partial<Omit<Preset, 'id'>>) => void;
}

const PresetEditor: React.FC<PresetEditorProps> = ({ preset, onUpdate }) => {
  return (
    <View style={styles.editorContainer}>
      <View style={styles.nameInputRow}>
        <Text style={styles.editorLabel}>name</Text>
        <TextInput
          style={styles.nameInput}
          value={preset.name}
          onChangeText={(text) => onUpdate(preset.id, { name: text })}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.text_muted}
        />
      </View>

      <View style={styles.stepperGrid}>
        <Stepper
          label="work"
          value={preset.workMinutes}
          onValueChange={(v) => onUpdate(preset.id, { workMinutes: v })}
          min={1}
          max={120}
        />
        <Stepper
          label="short break"
          value={preset.shortBreakMinutes}
          onValueChange={(v) => onUpdate(preset.id, { shortBreakMinutes: v })}
          min={1}
          max={60}
        />
        <Stepper
          label="long break"
          value={preset.longBreakMinutes}
          onValueChange={(v) => onUpdate(preset.id, { longBreakMinutes: v })}
          min={1}
          max={60}
        />
        <Stepper
          label="cycles"
          value={preset.cyclesBeforeLongBreak}
          onValueChange={(v) =>
            onUpdate(preset.id, { cyclesBeforeLongBreak: v })
          }
          min={1}
          max={10}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background_primary,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  heading: {
    fontFamily: typography.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.text_primary,
    marginBottom: 32,
    marginTop: 16,
  },
  sectionHeader: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginBottom: 16,
    marginTop: 32,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  displayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_primary,
  },
  presetSummary: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginTop: 4,
  },
  checkmark: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.text_primary,
    marginLeft: 12,
  },
  addPresetButton: {
    paddingVertical: 12,
    marginTop: 4,
  },
  addPresetText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_muted,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingVertical: 8,
  },
  toggleLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.text_primary,
  },
  aboutText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
  },
  editorContainer: {
    backgroundColor: colors.background_surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  editorLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.text_muted,
    marginRight: 12,
  },
  nameInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.text_primary,
    backgroundColor: colors.background_elevated,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  stepperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 16,
  },
});

export default SettingsScreen;
