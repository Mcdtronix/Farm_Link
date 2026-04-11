import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useFarmerDirectory, type FarmerProfile } from "@/hooks/useFarmerDirectory";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

export default function MapScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerProfile | null>(null);
  const [filterVerified, setFilterVerified] = useState(false);
  const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { getFarmers, loading: apiLoading, error } = useFarmerDirectory();

  useEffect(() => {
    loadFarmers();
  }, [filterVerified]);

  const loadFarmers = async () => {
    setLoading(true);
    const result = await getFarmers({
      search: search || undefined,
      verified: filterVerified || undefined,
      page_size: 50,
    });
    
    if (result) {
      setFarmers(result.results);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadFarmers();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setLocationGranted(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === "granted");
    })();
  }, []);

  const filtered = farmers.filter((f) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      f.farmer_name.toLowerCase().includes(q) ||
      f.county_name?.toLowerCase().includes(q) ||
      f.crops.some((c) => c.toLowerCase().includes(q));
    const matchVerified = !filterVerified || f.is_verified;
    return matchSearch && matchVerified;
  });

  const openGoogleMaps = (farmer: FarmerProfile) => {
    const { lat, lng } = farmer.coordinates;
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&q=${encodeURIComponent(farmer.name)}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  const callFarmer = (phone: string) => {
    if (Platform.OS !== "web") {
      Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
    }
  };

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
        <Text style={styles.headerTitle}>Farmer Directory</Text>
        <Text style={styles.headerSub}>
          Connect with {filtered.length} farmers - call or email directly
        </Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, county, crop..."
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterToggle, filterVerified && styles.filterToggleActive]}
            onPress={() => setFilterVerified((v) => !v)}
          >
            <Feather
              name="shield"
              size={14}
              color={filterVerified ? Colors.primary : Colors.textMuted}
            />
            <Text
              style={[
                styles.filterToggleText,
                filterVerified && { color: Colors.primary },
              ]}
            >
              Verified only
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Location banner */}
      {locationGranted === false && Platform.OS !== "web" && (
        <View style={styles.locationBanner}>
          <Feather name="map-pin" size={16} color={Colors.warning} />
          <Text style={styles.locationBannerText}>
            Enable location to see farmers sorted by distance
          </Text>
        </View>
      )}

      {/* Farmer List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0),
          gap: 12,
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="map-marker-off"
              size={64}
              color={Colors.border}
            />
            <Text style={styles.emptyTitle}>No farmers found</Text>
            <Text style={styles.emptyDesc}>Try adjusting your search</Text>
          </View>
        }
        renderItem={({ item }) => (
          <FarmerCard
            farmer={item}
            onViewMap={() => openGoogleMaps(item)}
            onCall={() => callFarmer(item.phone)}
            onSelect={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedFarmer(item);
            }}
          />
        )}
      />

      {/* Farmer Detail Modal */}
      {selectedFarmer && (
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedFarmer(null)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { paddingBottom: insets.bottom + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalAvatar}>
                <MaterialCommunityIcons
                  name="account"
                  size={36}
                  color={Colors.primaryLight}
                />
              </View>
              <View style={styles.modalInfo}>
                <View style={styles.modalNameRow}>
                  <Text style={styles.modalName}>{selectedFarmer.name}</Text>
                  {selectedFarmer.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.modalLocation}>
                  {selectedFarmer.location}
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {typeof selectedFarmer.rating === 'number' && !Number.isNaN(selectedFarmer.rating)
                      ? selectedFarmer.rating.toFixed(1)
                      : (Number(selectedFarmer.rating) && !Number.isNaN(Number(selectedFarmer.rating))
                          ? Number(selectedFarmer.rating).toFixed(1)
                          : 'N/A')}
                  </Text>
                  <Text style={styles.distanceText}>
                  · {typeof selectedFarmer.distance === 'number' && !Number.isNaN(selectedFarmer.distance)
                    ? `${selectedFarmer.distance.toFixed(1)} km away`
                    : 'Distance unknown'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalCrops}>
              <Text style={styles.modalCropsLabel}>Crops</Text>
              <View style={styles.cropsWrap}>
                {selectedFarmer.crops.map((crop) => (
                  <View key={crop} style={styles.cropChip}>
                    <Text style={styles.cropChipText}>{crop}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.modalStats}>
              <View style={styles.modalStat}>
                <MaterialCommunityIcons
                  name="tag-multiple"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.modalStatValue}>
                  {selectedFarmer.activeListings}
                </Text>
                <Text style={styles.modalStatLabel}>Active Listings</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStat}>
                <Feather name="map-pin" size={20} color={Colors.accent} />
                <Text style={styles.modalStatValue}>
                  {selectedFarmer.distance.toFixed(1)} km
                </Text>
                <Text style={styles.modalStatLabel}>Distance</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStat}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.modalStatValue}>
                  {selectedFarmer.rating.toFixed(1)}
                </Text>
                <Text style={styles.modalStatLabel}>Rating</Text>
              </View>
            </View>

            {/* Contact Information */}
            {(selectedFarmer.phone || selectedFarmer.email) && (
              <View style={styles.modalContact}>
                <Text style={styles.modalContactLabel}>📞 Contact {selectedFarmer.name}</Text>
                <Text style={styles.modalContactSub}>Tap to call or email directly</Text>
                <View style={styles.modalContactItems}>
                  {selectedFarmer.phone && (
                    <Pressable
                      style={styles.modalContactItem}
                      onPress={() => callFarmer(selectedFarmer.phone)}
                    >
                      <Feather name="phone" size={16} color={Colors.primary} />
                      <Text style={styles.modalContactText}>{selectedFarmer.phone}</Text>
                    </Pressable>
                  )}
                  {selectedFarmer.email && (
                    <Pressable
                      style={styles.modalContactItem}
                      onPress={() => Linking.openURL(`mailto:${selectedFarmer.email}`)}
                    >
                      <Feather name="mail" size={16} color={Colors.primary} />
                      <Text style={styles.modalContactText}>{selectedFarmer.email}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => callFarmer(selectedFarmer.phone)}
              >
                <Feather name="phone" size={18} color={Colors.primary} />
                <Text style={styles.modalBtnSecondaryText}>Call</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => openGoogleMaps(selectedFarmer)}
              >
                <Feather name="map" size={18} color="#fff" />
                <Text style={styles.modalBtnPrimaryText}>Open in Maps</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

function FarmerCard({
  farmer,
  onViewMap,
  onCall,
  onSelect,
}: {
  farmer: FarmerProfile;
  onViewMap: () => void;
  onCall: () => void;
  onSelect: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.farmerCard, pressed && { opacity: 0.95 }]}
      onPress={onSelect}
    >
      <View style={styles.farmerCardHeader}>
        <View style={styles.farmerAvatar}>
          <MaterialCommunityIcons
            name="account"
            size={28}
            color={Colors.primaryLight}
          />
        </View>
        <View style={styles.farmerMain}>
          <View style={styles.farmerNameRow}>
            <Text style={styles.farmerName}>{farmer.name}</Text>
            {farmer.isVerified && (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={10} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.farmerMeta}>
            <Feather name="map-pin" size={12} color={Colors.textMuted} />
            <Text style={styles.farmerLocation}>{farmer.location}</Text>
          </View>
        </View>
        <View style={styles.farmerRight}>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceVal}>
              {typeof farmer.distance === 'number' && !Number.isNaN(farmer.distance)
                ? `${farmer.distance.toFixed(1)} km`
                : 'N/A'}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingVal}>{
              typeof farmer.rating === 'number' && !Number.isNaN(farmer.rating)
                ? farmer.rating.toFixed(1)
                : (Number(farmer.rating) && !Number.isNaN(Number(farmer.rating))
                    ? Number(farmer.rating).toFixed(1)
                    : 'N/A')
            }</Text>
          </View>
        </View>
      </View>

      {/* Crops */}
      <View style={styles.farmerCrops}>
        {farmer.crops.slice(0, 3).map((crop) => (
          <View key={crop} style={styles.cropTag}>
            <Text style={styles.cropTagText}>{crop}</Text>
          </View>
        ))}
        {farmer.crops.length > 3 && (
          <View style={styles.cropTag}>
            <Text style={styles.cropTagText}>+{farmer.crops.length - 3}</Text>
          </View>
        )}
        <View style={styles.listingsBadge}>
          <Text style={styles.listingsText}>
            {farmer.activeListings} listings
          </Text>
        </View>
      </View>

      {/* Contact Info */}
      {(farmer.phone || farmer.email) && (
        <View style={styles.farmerContact}>
          {farmer.phone && (
            <Pressable
              style={styles.contactItem}
              onPress={() => callFarmer(farmer.phone)}
            >
              <Feather name="phone" size={14} color={Colors.primary} />
              <Text style={styles.contactText}>{farmer.phone}</Text>
            </Pressable>
          )}
          {farmer.email && (
            <Pressable
              style={styles.contactItem}
              onPress={() => Linking.openURL(`mailto:${farmer.email}`)}
            >
              <Feather name="mail" size={14} color={Colors.primary} />
              <Text style={styles.contactText}>{farmer.email}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.farmerActions}>
        <Pressable
          style={({ pressed }) => [
            styles.farmerActionBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onCall}
        >
          <Feather name="phone" size={14} color={Colors.primary} />
          <Text style={styles.farmerActionText}>Call</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.farmerActionBtnPrimary,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onViewMap}
        >
          <Feather name="map" size={14} color="#fff" />
          <Text style={styles.farmerActionPrimaryText}>View on Map</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginBottom: 14,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  filterRow: { flexDirection: "row", gap: 8 },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterToggleActive: {
    backgroundColor: "#EEF7F0",
    borderColor: Colors.primary,
  },
  filterToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  locationBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#D97706",
  },
  emptyState: {
    paddingTop: 80,
    alignItems: "center",
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
  farmerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  farmerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  farmerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  farmerMain: { flex: 1, gap: 4 },
  farmerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  farmerName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  farmerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  farmerLocation: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  farmerRight: { alignItems: "flex-end", gap: 5 },
  distanceBadge: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distanceVal: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingVal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  farmerCrops: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  cropTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EEF7F0",
  },
  cropTagText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  listingsBadge: {
    marginLeft: "auto" as never,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.accent + "20",
  },
  listingsText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.accentDark,
  },
  farmerContact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  farmerActions: {
    flexDirection: "row",
    gap: 10,
  },
  farmerActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  farmerActionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  farmerActionBtnPrimary: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  farmerActionPrimaryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalInfo: { flex: 1, gap: 4 },
  modalNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  modalLocation: {
    fontSize: 14,
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
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  distanceText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  modalCrops: { gap: 8 },
  modalCropsLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cropsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cropChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#EEF7F0",
  },
  cropChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  modalStats: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-around",
    alignItems: "center",
  },
  modalStat: { alignItems: "center", gap: 4 },
  modalStatValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  modalStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  modalStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  modalContact: { gap: 12 },
  modalContactLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalContactSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginBottom: 8,
  },
  modalContactItems: { gap: 8 },
  modalContactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  modalContactText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  modalBtnPrimary: {
    flex: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnSecondary: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  modalBtnPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  modalBtnSecondaryText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
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
    marginBottom: 32,
  },
  accessDeniedButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  accessDeniedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
