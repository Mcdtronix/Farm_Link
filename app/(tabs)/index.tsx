import { Colors } from "@/constants/colors";
import { formatPriceWithUnit } from "@/utils/formatPrice";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { MOCK_MARKET_PRICES, MOCK_PRODUCTS } from "@/data/mock";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const today = new Date();
const timeGreeting = () => {
  const h = today.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { products } = useProducts();

  // Recent listings for buyer home — most recently listed, capped at 5
  const recentProducts = user?.role !== 'farmer'
    ? [...products].sort((a, b) => new Date(b.listedDate).getTime() - new Date(a.listedDate).getTime()).slice(0, 5)
    : [];

  useEffect(() => {
    (async () => {
      try {
        const flash = await AsyncStorage.getItem("@agrilink_flash");
        if (flash === "login_success") {
          await AsyncStorage.removeItem("@agrilink_flash");
          Alert.alert("Login successful", "Welcome back!");
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const topPrices = MOCK_MARKET_PRICES.slice(0, 6);
  const featuredProducts = MOCK_PRODUCTS.slice(0, 4);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Hero */}
      <LinearGradient
        colors={["#1B4332", "#2D6A4F", "#40916C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.hero,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          },
        ]}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.greeting}>{timeGreeting()},</Text>
            <Text style={styles.heroName}>
              {user?.name.split(" ")[0] ?? "User"}
            </Text>
            <View
              style={[
                styles.roleBadge,
                user?.role === "farmer"
                  ? styles.roleBadgeFarmer
                  : styles.roleBadgeBuyer,
              ]}
            >
              <MaterialCommunityIcons
                name={user?.role === "farmer" ? "sprout" : "shopping"}
                size={12}
                color={user?.role === "farmer" ? "#065F46" : "#1E40AF"}
              />
              <Text
                style={[
                  styles.roleBadgeText,
                  user?.role === "farmer"
                    ? { color: "#065F46" }
                    : { color: "#1E40AF" },
                ]}
              >
                {user?.role === "farmer" ? "Farmer" : "Buyer"}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.notifBtn}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatChip icon="trending-up" label="Market Active" value="8 crops" />
          <StatChip icon="users" label="Farmers Online" value="142" />
          <StatChip icon="zap" label="Live Prices" value="Today" />
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {user?.role === "farmer" ? (
            <>
              <ActionCard
                icon="plus-circle"
                label="List Product"
                color="#2D6A4F"
                bg="#EEF7F0"
                onPress={() => router.push("/product/add")}
              />
              <ActionCard
                icon="bar-chart-2"
                label="Market Prices"
                color="#F4A261"
                bg="#FEF3E9"
                onPress={() => router.push("/(tabs)/marketplace")}
              />
              <ActionCard
                icon="sun"
                label="Crop Advisory"
                color="#3B82F6"
                bg="#EFF6FF"
                onPress={() => router.push("/(tabs)/advisory")}
              />
              <ActionCard
                icon="user"
                label="My Profile"
                color="#8B5CF6"
                bg="#F5F3FF"
                onPress={() => router.push("/(tabs)/profile")}
              />
            </>
          ) : (
            <>
              <ActionCard
                icon="search"
                label="Browse Market"
                color="#2D6A4F"
                bg="#EEF7F0"
                onPress={() => router.push("/(tabs)/marketplace")}
              />
              <ActionCard
                icon="map-pin"
                label="Find Farmers"
                color="#F4A261"
                bg="#FEF3E9"
                onPress={() => router.push("/(tabs)/map")}
              />
              {/* Buyer-specific design request: hide advisory + profile/edit from quick actions */}
            </>
          )}
        </View>
      </View>

      {/* Recent Listings — buyer-only */}
      {user?.role !== 'farmer' && recentProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Listings</Text>
            <Pressable onPress={() => router.push("/(tabs)/marketplace")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {recentProducts.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.9 }]}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
              >
                <View style={styles.recentIcon}>
                  <MaterialCommunityIcons name="sprout" size={24} color={Colors.primaryLight} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {item.farmerName} · {item.county}
                  </Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentPrice}>{formatPriceWithUnit(item.price, item.unit)}</Text>
                  <Feather name="chevron-right" size={16} color={Colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Live Tomato Prices — disabled (mock data; wire up to market-prices API endpoint) */}
      {false && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Live Tomato Prices (USD)</Text>
            <Pressable onPress={() => router.push("/(tabs)/marketplace")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionSub}>
            Updated{" "}
            {today.toLocaleDateString("en-ZW", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
          <View style={styles.pricesGrid}>
            {topPrices.map((item) => (
              <PriceChip key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      {/* Fresh Tomato Listings — disabled (mock data; wire up to /api/v1/products/ endpoint) */}
      {false && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Fresh Tomato Listings</Text>
            <Pressable onPress={() => router.push("/(tabs)/marketplace")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <FlatList
            data={featuredProducts}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.productsList}
            renderItem={({ item }) => (
              <FeaturedProductCard
                item={item}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
              />
            )}
            scrollEnabled={featuredProducts.length > 0}
          />
        </View>
      )}

      {/* Tomato Grading & Pricing AI — farmer-only; hidden for buyer accounts */}
      {user?.role === 'farmer' && (
        <View style={[styles.section, { paddingHorizontal: 20 }]}>
          <Pressable
            onPress={() => router.push("/ml/tomato")}
            style={({ pressed }) => [styles.advisoryBanner, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={["#1E3A5F", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.advisoryGradient}
            >
              <View style={styles.advisoryContent}>
                <Ionicons name="leaf" size={32} color="#93C5FD" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.advisoryTitle}>Tomato Grading & Pricing AI</Text>
                  <Text style={styles.advisoryDesc}>
                    Snap your tomatoes and get instant grade & USD price guidance
                  </Text>
                </View>
                <Feather name="arrow-right" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statChip}>
      <Feather name={icon} size={14} color="rgba(255,255,255,0.75)" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      style={[styles.actionCard]}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()
      }
    >
      <Animated.View style={[styles.actionCardInner, { transform: [{ scale }] }]}>
        <View style={[styles.actionIcon, { backgroundColor: bg }]}>
          <Feather name={icon} size={22} color={color} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function PriceChip({ item }: { item: (typeof MOCK_MARKET_PRICES)[0] }) {
  const up = item.change > 0;
  const flat = item.change === 0;
  return (
    <View style={styles.priceChip}>
      <Text style={styles.priceCrop}>{item.crop}</Text>
      <Text style={styles.priceValue}>
        {formatPriceWithUnit(item.price, item.unit)}
      </Text>
      <View
        style={[
          styles.priceBadge,
          up
            ? { backgroundColor: "#D1FAE5" }
            : flat
            ? { backgroundColor: "#F3F4F6" }
            : { backgroundColor: "#FEE2E2" },
        ]}
      >
        <Feather
          name={up ? "trending-up" : flat ? "minus" : "trending-down"}
          size={12}
          color={up ? "#059669" : flat ? "#6B7280" : "#DC2626"}
        />
        <Text
          style={[
            styles.priceChange,
            { color: up ? "#059669" : flat ? "#6B7280" : "#DC2626" },
          ]}
        >
          {flat ? "Stable" : `${up ? "+" : ""}${item.changePercent.toFixed(1)}%`}
        </Text>
      </View>
    </View>
  );
}

function FeaturedProductCard({
  item,
  onPress,
}: {
  item: (typeof MOCK_PRODUCTS)[0];
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.featuredCard, pressed && { opacity: 0.9 }]}
      onPress={onPress}
    >
      <View style={styles.featuredImgWrap}>
        <View style={styles.featuredImgPlaceholder}>
          <MaterialCommunityIcons name="sprout" size={40} color={Colors.primaryLight} />
        </View>
        {item.isOrganic && (
          <View style={styles.organicBadge}>
            <Text style={styles.organicText}>Organic</Text>
          </View>
        )}
      </View>
      <View style={styles.featuredInfo}>
        <Text style={styles.featuredName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.featuredPrice}>
          {formatPriceWithUnit(item.price, item.unit)}
        </Text>
        <Text style={styles.featuredFarmer} numberOfLines={1}>
          {item.farmerLocation}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 2,
  },
  heroName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  roleBadgeFarmer: { backgroundColor: Colors.farmerBadge },
  roleBadgeBuyer: { backgroundColor: Colors.buyerBadge },
  roleBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statChip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: Platform.OS === "web" ? 20 : 20,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  actionCard: {
    width: (width - 40 - 12) / 2,
  },
  actionCardInner: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  pricesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  priceChip: {
    width: (width - 40 - 10) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  priceCrop: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  priceValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  priceChange: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  productsList: { paddingRight: 20, gap: 12 },
  featuredCard: {
    width: 160,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  featuredImgWrap: { position: "relative" },
  featuredImgPlaceholder: {
    height: 120,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  organicBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  organicText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  featuredInfo: { padding: 12, gap: 3 },
  featuredName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  featuredPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  featuredFarmer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  advisoryBanner: { borderRadius: 20, overflow: "hidden" },
  advisoryGradient: { borderRadius: 20 },
  advisoryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
  },
  advisoryTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  advisoryDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },  recentList: {
    marginTop: 10,
    gap: 8,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  recentMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  recentRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },});
