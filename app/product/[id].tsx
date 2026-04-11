import { Colors } from "@/constants/colors";
import { formatPriceWithUnit } from "@/utils/formatPrice";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { products, deleteProduct } = useProducts();
  const [contactShown, setContactShown] = useState(false);

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <View style={styles.notFound}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={Colors.border} />
        <Text style={styles.notFoundText}>Product not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = user?.id === product.farmerId;

  const handleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContactShown(true);
  };

  const handleCall = () => {
    const phone = "+263712345678";
    if (Platform.OS !== "web") {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove Listing",
      "Are you sure you want to remove this product listing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Removed", "Your listing has been removed.", [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]);
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to remove listing. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120 + (Platform.OS === "web" ? 34 : insets.bottom),
        }}
      >
        {/* Product Image Hero */}
        <View style={styles.imageHero}>
          {product.images?.[0] ? (
            <Image
              source={{ uri: product.images[0] }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : null}
          <LinearGradient
            colors={["#EEF7F0", "#D1FAE5"]}
            style={styles.imagePlaceholder}
          >
            <MaterialCommunityIcons
              name="sprout"
              size={100}
              color={Colors.primaryLight}
            />
          </LinearGradient>

          <View style={styles.imageOverlay}>
            {product.isOrganic && (
              <View style={styles.organicBadge}>
                <MaterialCommunityIcons name="leaf" size={12} color="#fff" />
                <Text style={styles.organicText}>Organic</Text>
              </View>
            )}
          </View>

          {/* Back button overlay */}
          <Pressable
            style={[styles.backBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 56) }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Product Header */}
          <View style={styles.productHeader}>
            <View style={styles.productTitleRow}>
              <Text style={styles.productName}>{product.name}</Text>
              {isOwner && (
                <Pressable
                  onPress={handleDelete}
                  style={styles.deleteBtn}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={18} color={Colors.error} />
                </Pressable>
              )}
            </View>

            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPriceWithUnit(product.price, product.unit)}</Text>
              <Text style={styles.unit}>per {product.unit}</Text>
            </View>

            {/* Rating + Reviews */}
            {product.rating > 0 && (
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(product.rating) ? "star" : "star-outline"}
                    size={16}
                    color="#F59E0B"
                  />
                ))}
                <Text style={styles.ratingText}>
                  {product.rating.toFixed(1)} ({product.reviews} reviews)
                </Text>
              </View>
            )}
          </View>

          {/* Stock Info */}
          <View style={styles.stockCard}>
            <View style={styles.stockItem}>
              <MaterialCommunityIcons name="package-variant" size={22} color={Colors.primary} />
              <Text style={styles.stockValue}>{product.quantity}</Text>
              <Text style={styles.stockLabel}>{product.unit}s Available</Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockItem}>
              <Feather name="calendar" size={22} color={Colors.accent} />
              <Text style={styles.stockValue}>
                {new Date(product.harvestDate).toLocaleDateString("en-ZW", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
              <Text style={styles.stockLabel}>Harvested</Text>
            </View>
            <View style={styles.stockDivider} />
            <View style={styles.stockItem}>
              <Feather name="map-pin" size={22} color="#8B5CF6" />
              <Text style={styles.stockValue} numberOfLines={1}>
                {product.county}
              </Text>
              <Text style={styles.stockLabel}>County</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Farmer Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sold by</Text>
            <View style={styles.farmerCard}>
              <View style={styles.farmerAvatar}>
                <MaterialCommunityIcons
                  name="account"
                  size={32}
                  color={Colors.primaryLight}
                />
              </View>
              <View style={styles.farmerInfo}>
                <Text style={styles.farmerName}>{product.farmerName}</Text>
                <View style={styles.farmerLocation}>
                  <Feather name="map-pin" size={13} color={Colors.textMuted} />
                  <Text style={styles.farmerLocationText}>
                    {product.farmerLocation}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      {!isOwner && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12),
            },
          ]}
        >
          {!contactShown ? (
            <Pressable
              style={({ pressed }) => [
                styles.contactBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleContact}
            >
              <MaterialCommunityIcons name="message" size={20} color="#fff" />
              <Text style={styles.contactBtnText}>Contact Farmer</Text>
            </Pressable>
          ) : (
            <View style={styles.contactRevealed}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Farmer's Contact</Text>
                <Text style={styles.contactPhone}>{product.farmerName}</Text>
              <Text style={styles.contactPhoneNum}>+263 712 345 678</Text>
              </View>
              <Pressable style={styles.callBtn} onPress={handleCall}>
                <Feather name="phone" size={20} color="#fff" />
                <Text style={styles.callBtnText}>Call Now</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {isOwner && (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12),
            },
          ]}
        >
          <View style={styles.ownerActions}>
            <View style={styles.ownerBadge}>
              <Feather name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.ownerBadgeText}>Your listing</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color={Colors.error} />
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.background,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  backLink: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  imageHero: {
    height: 300,
    position: "relative",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 12,
    left: 16,
    flexDirection: "row",
    gap: 8,
  },
  organicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  organicText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  content: { padding: 20, gap: 20 },
  productHeader: { gap: 10 },
  productTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productName: {
    flex: 1,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  categoryBadge: {
    backgroundColor: "#EEF7F0",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  price: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  unit: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  stockCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stockItem: { alignItems: "center", gap: 5, flex: 1 },
  stockValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  stockLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  stockDivider: { width: 1, height: 50, backgroundColor: Colors.border },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  farmerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  farmerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  farmerInfo: { flex: 1, gap: 4 },
  farmerName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  farmerLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  farmerLocationText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  contactBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  contactBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  contactRevealed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF7F0",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  contactInfo: { flex: 1 },
  contactLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  contactPhone: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  contactPhoneNum: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  callBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  ownerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ownerBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#065F46",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  removeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.error,
  },
});
