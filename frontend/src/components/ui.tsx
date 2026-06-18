/**
 * Reusable neo-brutalist primitives: NeoButton, NeoCard, NeoInput, Chip, Pill.
 */

import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from "react-native";

import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "yellow";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  testID?: string;
  fullWidth?: boolean;
};

export function NeoButton({ label, onPress, variant = "primary", style, textStyle, disabled, testID, fullWidth }: ButtonProps) {
  const [pressed, setPressed] = React.useState(false);
  const bg =
    variant === "primary" ? COLORS.pink :
    variant === "danger" ? COLORS.danger :
    variant === "yellow" ? COLORS.yellow :
    COLORS.white;
  const textColor = variant === "danger" ? COLORS.white : COLORS.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[
        styles.btn,
        { backgroundColor: bg },
        fullWidth && { alignSelf: "stretch" },
        pressed ? styles.btnPressed : SHADOW.hard,
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: textColor }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function NeoCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, SHADOW.hard, style]}>{children}</View>;
}

type InputProps = TextInputProps & { label?: string; testID?: string };
export function NeoInput({ label, style, testID, ...rest }: InputProps) {
  return (
    <View style={{ alignSelf: "stretch" }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
  bg?: string;
};
export function Chip({ label, active, onPress, testID, bg }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? COLORS.text : bg || COLORS.white },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? COLORS.white : COLORS.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ children, bg = COLORS.yellow, style }: { children: React.ReactNode; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {typeof children === "string" ? <Text style={styles.pillText}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnPressed: { transform: [{ translateX: 4 }, { translateY: 4 }] },
  btnText: { ...FONTS.bodyLg, fontWeight: "800" },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
  },
  inputLabel: { ...FONTS.label, marginBottom: SPACING.xs, color: COLORS.text },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignSelf: "flex-start",
  },
  pillText: { fontWeight: "800", fontSize: 12, color: COLORS.text, letterSpacing: 0.4 },
});
