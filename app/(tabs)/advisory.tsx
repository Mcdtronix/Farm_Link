import { Colors } from "@/constants/colors";
import { MOCK_ADVISORIES } from "@/data/mock";
import type { Advisory } from "@/data/mock";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORY_FILTERS = ["All", "grading", "pricing", "market", "quality", "tips"] as const;

const CATEGORY_CONFIG: Record<
  Advisory["category"] | "All",
  { label: string; icon: string; color: string; bg: string }
> = {
  All: { label: "All", icon: "apps", color: Colors.textSecondary, bg: Colors.border },
  grading: { label: "Grading", icon: "grid", color: "#059669", bg: "#D1FAE5" },
  pricing: { label: "Pricing", icon: "dollar-sign", color: "#2563EB", bg: "#DBEAFE" },
  market: { label: "Best Markets", icon: "trending-up", color: "#D97706", bg: "#FEF3C7" },
  quality: { label: "Quality Checks", icon: "check-circle", color: "#7C3AED", bg: "#EDE9FE" },
  tips: { label: "Handling Tips", icon: "info", color: "#EC4899", bg: "#FCE7F3" },
};

const URGENCY_CONFIG: Record<
  Advisory["urgency"],
  { label: string; color: string; bg: string }
> = {
  high: { label: "High Priority", color: "#DC2626", bg: "#FEE2E2" },
  medium: { label: "Medium", color: "#D97706", bg: "#FEF3C7" },
  low: { label: "Low", color: "#059669", bg: "#D1FAE5" },
};

export default function AdvisoryScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<
    (typeof CATEGORY_FILTERS)[number]
  >("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered =
    activeFilter === "All"
      ? MOCK_ADVISORIES
      : MOCK_ADVISORIES.filter((a) => a.category === activeFilter);

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0),
        }}
        ListHeaderComponent={
          <>
            {/* Hero Header */}
            <LinearGradient
              colors={["#1E3A5F", "#1D4ED8", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hero,
                {
                  paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
                },
              ]}
            >
              <View style={styles.heroDecor} />
              <View style={styles.heroDecor2} />
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <Ionicons name="leaf" size={14} color="#93C5FD" />
                  <Text style={styles.heroBadgeText}>Tomato Grading & Pricing AI</Text>
                </View>
                <Text style={styles.heroTitle}>Tomato Grading & Pricing</Text>
                <Text style={styles.heroSub}>
                  See your tomato grade, price band in USD & best Zimbabwe markets
                </Text>
              </View>

              <View style={styles.heroStats}>
              <HeroStat value="5" label="Grading tips" />
                <View style={styles.heroStatDivider} />
              <HeroStat value="10+" label="Key markets" />
                <View style={styles.heroStatDivider} />
                <HeroStat value="Today" label="Updated" />
              </View>
            </LinearGradient>

            {/* Filter Chips */}
            <FlatList
              data={CATEGORY_FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.filters}
              renderItem={({ item: filter }) => {
                const cfg = CATEGORY_CONFIG[filter];
                const isActive = activeFilter === filter;
                return (
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && { backgroundColor: cfg.bg, borderColor: cfg.color },
                    ]}
                    onPress={() => setActiveFilter(filter)}
                  >
                    <Feather
                      name={cfg.icon as keyof typeof Feather.glyphMap}
                      size={13}
                      color={isActive ? cfg.color : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.filterText,
                        isActive && { color: cfg.color },
                      ]}
                    >
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.resultsCount}>
              {filtered.length} advisory{filtered.length !== 1 ? "s" : ""}
            </Text>
          </>
        }
        renderItem={({ item }) => (
          <AdvisoryCard
            item={item}
            isExpanded={expanded === item.id}
            onToggle={() =>
              setExpanded((prev) => (prev === item.id ? null : item.id))
            }
          />
        )}
      />
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function AdvisoryCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: Advisory;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cfg = CATEGORY_CONFIG[item.category];
  const urgency = URGENCY_CONFIG[item.urgency];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.97 },
      ]}
      onPress={onToggle}
    >
      {/* Urgency accent */}
      <View
        style={[
          styles.urgencyBar,
          {
            backgroundColor:
              item.urgency === "high"
                ? Colors.error
                : item.urgency === "medium"
                ? Colors.warning
                : Colors.success,
          },
        ]}
      />

      <View style={styles.cardContent}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={[styles.categoryBadge, { backgroundColor: cfg.bg }]}>
            <Feather
              name={cfg.icon as keyof typeof Feather.glyphMap}
              size={12}
              color={cfg.color}
            />
            <Text style={[styles.categoryText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
          <View
            style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}
          >
            <Text style={[styles.urgencyText, { color: urgency.color }]}>
              {urgency.label}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>

        {/* Description */}
        <Text style={styles.cardDesc} numberOfLines={isExpanded ? undefined : 2}>
          {item.description}
        </Text>

        {/* Crops */}
        <View style={styles.cropsRow}>
          <MaterialCommunityIcons
            name="sprout"
            size={14}
            color={Colors.primary}
          />
          <Text style={styles.cropsText}>{item.crops.join(" · ")}</Text>
        </View>

        {/* Expanded content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Feather name="map-pin" size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>{item.region}</Text>
            </View>

            <View style={styles.infoRow}>
              <Feather name="calendar" size={14} color={Colors.textMuted} />
              <Text style={styles.infoText}>
                Valid:{" "}
                {new Date(item.validFrom).toLocaleDateString("en-ZW", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(item.validTo).toLocaleDateString("en-ZW", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>

            <View style={styles.recommendationBox}>
              <View style={styles.recommendationHeader}>
                <Ionicons name="bulb" size={16} color={Colors.accent} />
                <Text style={styles.recommendationTitle}>Recommendation</Text>
              </View>
              <Text style={styles.recommendationText}>
                {item.recommendation}
              </Text>
            </View>

            <View style={styles.sourceRow}>
              <Feather name="shield" size={12} color={Colors.textMuted} />
              <Text style={styles.sourceText}>Source: {item.source}</Text>
            </View>
          </View>
        )}

        {/* Toggle button */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {isExpanded ? "Show less" : "Read more"}
          </Text>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.primary}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroDecor: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -60,
    right: -60,
  },
  heroDecor2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: 10,
    left: 20,
  },
  heroContent: { marginBottom: 20 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(147,197,253,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  heroBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#93C5FD",
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  heroStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-around",
  },
  heroStat: { alignItems: "center" },
  heroStatValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  heroStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: "row",
  },
  urgencyBar: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardContent: { flex: 1, padding: 16, gap: 10 },
  cardTopRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  urgencyText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cropsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cropsText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  expandedContent: { gap: 10 },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  recommendationBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recommendationTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  recommendationText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    paddingTop: 4,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedMessage: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  accessDeniedSubMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
