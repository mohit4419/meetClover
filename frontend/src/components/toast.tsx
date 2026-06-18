/**
 * Toast — lightweight global toast queue used in place of Alert.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "@/src/theme";

type Toast = { id: string; text: string; type: "info" | "success" | "danger" };
type Ctx = { show: (text: string, type?: Toast["type"]) => void };

const ToastCtx = createContext<Ctx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, text, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 2800);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <View pointerEvents="none" style={[styles.host, { top: insets.top + 12 }]}>
        {items.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t }: { t: Toast }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    return () => { Animated.timing(op, { toValue: 0, duration: 180, useNativeDriver: true }).start(); };
  }, [op]);
  const bg =
    t.type === "success" ? COLORS.success :
    t.type === "danger" ? COLORS.danger :
    COLORS.yellow;
  return (
    <Animated.View style={[styles.toast, SHADOW.hard, { backgroundColor: bg, opacity: op }]}>
      <Text style={styles.text} numberOfLines={3}>{t.text}</Text>
    </Animated.View>
  );
}

export function useToast() { return useContext(ToastCtx); }

const styles = StyleSheet.create({
  host: { position: "absolute", left: SPACING.md, right: SPACING.md, alignItems: "center", zIndex: 9999 },
  toast: {
    minWidth: "60%",
    maxWidth: "100%",
    borderWidth: 3,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: 8,
  },
  text: { color: COLORS.text, fontWeight: "800", fontSize: 14, textAlign: "center" },
});
