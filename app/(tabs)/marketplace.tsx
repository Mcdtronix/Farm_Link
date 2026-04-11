import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { useApiData, type MarketPrice } from "@/hooks/useApiData";
import { useUserLookup } from "@/hooks/useUserLookup";
import { formatPriceWithUnit } from "@/utils/formatPrice";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState, useEffect } from "react";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { products, isLoading } = useProducts();
  const { getUserById } = useUserLookup();
  const { getMarketPrices, getCategories } = useApiData();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"products" | "prices">("products");
  const [sortBy, setSortBy] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    loadMarketPrices();
    loadCategories();
  }, []);

  const loadMarketPrices = async () => {
    setPricesLoading(true);
    const prices = await getMarketPrices();
    if (prices) {
      setMarketPrices(prices);
    }
    setPricesLoading(false);
  };

  const loadCategories = async () => {
    const cats = await getCategories();
    if (cats) {
      setCategories(["All", ...cats.map(c => c.name)]);
    }
  };

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.farmerName.toLowerCase().includes(q) ||
          p.county.toLowerCase().includes(q)
      );
    }
    if (activeCategory !== "All") {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (sortBy === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, search, activeCategory, sortBy]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Tomato Market (Zimbabwe)</Text>
            <Text style={styles.headerSub}>
              {products.length} active tomato listings in USD
            </Text>
          </View>
          {user?.role === "farmer" && (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/product/add");
              }}
            >
              <Feather name="plus" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tomatoes, farmers, markets..."
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tab, activeTab === "products" && styles.tabActive]}
            onPress={() => setActiveTab("products")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "products" && styles.tabTextActive,
              ]}
            >
              Listings
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "prices" && styles.tabActive]}
            onPress={() => setActiveTab("prices")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "prices" && styles.tabTextActive,
              ]}
            >
              Price Board
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "products" ? (
        <>
          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.catChip,
                  activeCategory === cat && styles.catChipActive,
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text
                  style={[
                    styles.catText,
                    activeCategory === cat && styles.catTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Sort Row */}
          <View style={styles.sortRow}>
              <Text style={styles.resultCount}>{filtered.length} tomato offers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sortBtns}>
                {(
                  [
                    { key: "recent", label: "Newest" },
                    { key: "price_asc", label: "Lowest price" },
                    { key: "price_desc", label: "Highest price" },
                  ] as const
                ).map((s) => (
                  <Pressable
                    key={s.key}
                    style={[
                      styles.sortBtn,
                      sortBy === s.key && styles.sortBtnActive,
                    ]}
                    onPress={() => setSortBy(s.key)}
                  >
                    <Text
                      style={[
                        styles.sortText,
                        sortBy === s.key && styles.sortTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Product List */}
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="sprout-outline" size={64} color={Colors.border} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyDesc}>Try a different search or category</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              numColumns={2}
              columnWrapperStyle={styles.columnWrap}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.productCard,
                    pressed && { opacity: 0.9 },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: item.id },
                    })
                  }
                >
                  <View style={styles.productImgWrap}>
                    {item.images?.[0] ? (
                      <Image
                        source={{ uri: item.images[0] }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : null}
                    <MaterialCommunityIcons
                      name="sprout"
                      size={44}
                      color={Colors.primaryLight}
                    />
                    {item.isOrganic && (
                      <View style={styles.organicBadge}>
                        <Text style={styles.organicText}>Organic</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.productPrice}>
                      {formatPriceWithUnit(item.price, item.unit)}
                    </Text>
                    <View style={styles.productFarmer}>
                      <Text style={styles.farmerName} numberOfLines={1}>
                        {item.farmerName}
                      </Text>
                      <TouchableOpacity
                        style={styles.farmerProfileButton}
                        onPress={async () => {
                          try {
                            const farmerData = await getUserById(item.farmerId);
                            if (farmerData) {
                              router.push({
                                pathname: "/user/[id]",
                                params: { id: item.farmerId },
                              });
                            }
                          } catch (error) {
                            console.error('Failed to load farmer profile:', error);
                          }
                        }}
                      >
                        <Ionicons name="person" size={12} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.productMeta}>
                      <Feather name="map-pin" size={11} color={Colors.textMuted} />
                      <Text style={styles.productLocation} numberOfLines={1}>
                        {item.county}
                      </Text>
                    </View>
                    <View style={styles.productRating}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {item.rating > 0 ? item.rating.toFixed(1) : "New"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      ) : (
        <PriceBoard />
      )}
    </View>
  );
}

function PriceBoard() {
  if (pricesLoading) {
    return (
      <View style={styles.priceListContent}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading market prices...</Text>
      </View>
    );
  }
  
  return (
    <FlatList
      data={marketPrices}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.priceListContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.priceBoardHeader}>
          <Text style={styles.priceBoardTitle}>Tomato Price Board (USD)</Text>
          <Text style={styles.priceBoardSub}>
            Mbare Musika, Bulawayo CBD, Sakubva & major Zimbabwe markets
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const up = item.change > 0;
        const flat = item.change === 0;
        return (
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={styles.priceName}>{item.crop}</Text>
              <Text style={styles.priceMarket}>{item.market}</Text>
            </View>
            <View style={styles.priceRight}>
              <Text style={styles.priceVal}>
                {formatPriceWithUnit(item.price, item.unit)}
              </Text>
              <View
                style={[
                  styles.changeChip,
                  up
                    ? { backgroundColor: "#D1FAE5" }
                    : flat
                    ? { backgroundColor: "#F3F4F6" }
                    : { backgroundColor: "#FEE2E2" },
                ]}
              >
                <Feather
                  name={
                    up ? "arrow-up" : flat ? "minus" : "arrow-down"
                  }
                  size={12}
                  color={up ? "#059669" : flat ? "#6B7280" : "#DC2626"}
                />
                <Text
                  style={[
                    styles.changeText,
                    {
                      color: up ? "#059669" : flat ? "#6B7280" : "#DC2626",
                    },
                  ]}
                >
                  {flat
                    ? "Stable"
                    : `${up ? "+" : ""}${item.changePercent.toFixed(1)}%`}
                </Text>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 0,
    borderRadius: 12,
    backgroundColor: Colors.background,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  tabTextActive: { color: "#FFFFFF" },
  categories: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  catTextActive: { color: "#FFFFFF" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  resultCount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  sortBtns: { flexDirection: "row", gap: 8 },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnActive: {
    backgroundColor: Colors.primaryLight + "33",
    borderColor: Colors.primaryLight,
  },
  sortText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  sortTextActive: { color: Colors.primary },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  columnWrap: { gap: 10, marginBottom: 10, paddingHorizontal: 4 },
  productCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  productImgWrap: {
    height: 110,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  organicBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  organicText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  productInfo: { padding: 10, gap: 3 },
  productName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  productFarmer: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  productLocation: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  productRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  farmerName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  farmerProfileButton: {
    backgroundColor: 'transparent',
    padding: 4,
    borderRadius: 4,
  },
  priceListContent: { paddingHorizontal: 20, paddingBottom: 120 },
  priceBoardHeader: { marginBottom: 16, marginTop: 8 },
  priceBoardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  priceBoardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  priceLeft: { gap: 3 },
  priceRight: { alignItems: "flex-end", gap: 6 },
  priceName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  priceMarket: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  priceVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  changeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
