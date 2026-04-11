const PRIMARY = "#2D6A4F";
const SECONDARY = "#52B788";
const ACCENT = "#F4A261";
const ACCENT_DARK = "#E76F51";

export const Colors = {
  primary: PRIMARY,
  primaryDark: "#1B4332",
  primaryLight: "#74C69D",
  secondary: SECONDARY,
  accent: ACCENT,
  accentDark: ACCENT_DARK,
  background: "#F7F5F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  textPrimary: "#1A2E1B",
  textSecondary: "#6B7C6D",
  textMuted: "#9CA8A0",
  textOnPrimary: "#FFFFFF",
  textOnAccent: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  farmerBadge: "#D1FAE5",
  farmerBadgeText: "#065F46",
  buyerBadge: "#DBEAFE",
  buyerBadgeText: "#1E40AF",
  overlay: "rgba(0,0,0,0.5)",
  overlayLight: "rgba(0,0,0,0.15)",
  gradientStart: "#2D6A4F",
  gradientEnd: "#1B4332",
  shimmer1: "#E8E4DC",
  shimmer2: "#F3F0E8",
  tabBar: "#FFFFFF",
  tabBarActive: "#2D6A4F",
  tabBarInactive: "#9CA8A0",
};

export default {
  light: {
    text: Colors.textPrimary,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.tabBarInactive,
    tabIconSelected: Colors.tabBarActive,
  },
};
