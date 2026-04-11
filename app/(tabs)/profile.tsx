import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { formatPriceWithUnit } from "@/utils/formatPrice";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState, useEffect  } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile } = useAuth();
  const { getProductsByFarmer } = useProducts();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editLocation, setEditLocation] = useState(user?.location || "");
  const [editBio, setEditBio] = useState(user?.bio || "");
  const [editFarmSize, setEditFarmSize] = useState(user?.farmSize || "");
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const handleEdit = () => {
    setEditing(true);
    setEditName(user?.name || "");
    setEditPhone(user?.phone || "");
    setEditLocation(user?.location || "");
    setEditBio(user?.bio || "");
    setEditFarmSize(user?.farmSize || "");
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }
    if (!editPhone.trim()) {
      Alert.alert("Validation", "Phone is required");
      return;
    }
    setSaving(true);
    try {
      console.log(`🔧 FRONTEND PROFILE UPDATE:`);
      console.log(`   Updates: ${JSON.stringify({
        name: editName,
        phone: editPhone,
        location: editLocation,
        bio: editBio,
        farmSize: editFarmSize,
      }, null, 2)}`);

      // Use updateProfile from AuthContext
      if (updateProfile) {
        await updateProfile({
          name: editName,
          phone: editPhone,
          location: editLocation,
          bio: editBio,
          farmSize: editFarmSize,
        });
      }

      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error: any) {
      console.error(`❌ PROFILE UPDATE ERROR: ${error.message}`);
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } finally {
            Alert.alert("Signed out", "You have been logged out successfully.", [
              {
                text: "OK",
                onPress: () => router.replace("/(auth)/welcome"),
              },
            ]);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      if (user?.role === "farmer") {
        const products = await getProductsByFarmer(user.id);
        setMyProducts(products);
      }
      setLoadingProducts(false);
    };
    fetchProducts();
  }, [user]);

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <Ionicons name="person-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: Colors.textPrimary }}>
          Not signed in
        </Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 }}>
          Please log in to view your profile.
        </Text>
        <Pressable
          style={{ backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0),
          }}
        >
          {/* Profile Hero */}
          <LinearGradient
            colors={
              user.role === "farmer"
                ? ["#1B4332", "#2D6A4F"]
                : ["#1E3A5F", "#2563EB"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.hero,
              {
                paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
              },
            ]}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroContent}>
                <Text style={styles.heroName}>{user.name}</Text>
                <Text style={styles.heroEmail}>{user.email}</Text>
              </View>
              <View style={styles.heroRight}>
                {/* {editing ? (
                  <View style={styles.editingIndicator}>
                    <Text style={styles.editingText}>Editing</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.editBtn}
                    onPress={handleEdit}
                    hitSlop={12}
                  >
                    <Feather name="edit-2" size={18} color="#fff" />
                  </Pressable>
                )} */}
                <View style={styles.avatarWrap}>
                  <MaterialCommunityIcons
                    name="account"
                    size={52}
                    color={Colors.primaryLight}
                  />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.roleBadge,
                user.role === "farmer"
                  ? styles.roleFarmer
                  : styles.roleBuyer,
              ]}
            >
              <MaterialCommunityIcons
                name={user.role === "farmer" ? "sprout" : "shopping"}
                size={13}
                color={user.role === "farmer" ? "#065F46" : "#1E40AF"}
              />
              <Text
                style={[
                  styles.roleText,
                  user.role === "farmer"
                    ? { color: "#065F46" }
                    : { color: "#1E40AF" },
                ]}
              >
                {user.role === "farmer" ? "Farmer" : "Buyer"}
              </Text>
              {user.verified && (
                <>
                  <View style={styles.roleDot} />
                  <Feather name="shield" size={11} color={user.role === "farmer" ? "#065F46" : "#1E40AF"} />
                  <Text
                    style={[
                      styles.roleText,
                      user.role === "farmer"
                        ? { color: "#065F46" }
                        : { color: "#1E40AF" },
                    ]}
                  >
                    Verified
                  </Text>
                </>
              )}
            </View>

            {/* Stats */}
            {user.role === "farmer" && (
              <View style={styles.heroStats}>
                <StatBox
                  icon="package"
                  value={String(myProducts.length)}
                  label="Listings"
                />
                <View style={styles.statDivider} />
                <StatBox
                  icon="star"
                  value={user.rating ? user.rating.toFixed(1) : "New"}
                  label="Rating"
                />
                <View style={styles.statDivider} />
                <StatBox
                  icon="trending-up"
                  value={String(user.totalSales ?? 0)}
                  label="Sales"
                />
              </View>
            )}
          </LinearGradient>

          {/* Edit Form / Info */}
          {editing ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Edit Profile</Text>
              <View style={styles.form}>
                <EditField
                  label="Full Name"
                  icon="user"
                  value={editName}
                  onChangeText={setEditName}
                />
                <EditField
                  label="Phone"
                  icon="phone"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
                <EditField
                  label="Location"
                  icon="map-pin"
                  value={editLocation}
                  onChangeText={setEditLocation}
                />
                {user.role === "farmer" && (
                  <EditField
                    label="Farm Size"
                    icon="grid"
                    value={editFarmSize}
                    onChangeText={setEditFarmSize}
                    placeholder="e.g. 5 acres"
                  />
                )}
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Bio</Text>
                  <View style={[styles.inputWrap, styles.textAreaWrap]}>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={editBio}
                      onChangeText={setEditBio}
                      placeholder="Tell buyers about yourself..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                <View style={styles.editActions}>
                  <Pressable
                    style={[styles.cancelBtn]}
                    onPress={() => setEditing(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveText}>Save Changes</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Info Cards */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Info</Text>
                <View style={styles.infoCard}>
                  <InfoRow icon="mail" label="Email" value={user.email} />
                  <View style={styles.infoDivider} />
                  <InfoRow icon="phone" label="Phone" value={user.phone} />
                  <View style={styles.infoDivider} />
                  <InfoRow icon="map-pin" label="Location" value={user.location} />
                  <View style={styles.infoDivider} />
                  <InfoRow icon="map" label="County" value={user.county} />
                  {user.role === "farmer" && user.farmSize && (
                    <>
                      <View style={styles.infoDivider} />
                      <InfoRow
                        icon="grid"
                        label="Farm Size"
                        value={user.farmSize}
                      />
                    </>
                  )}
                  {user.role === "farmer" && user.crops && user.crops.length > 0 && (
                    <>
                      <View style={styles.infoDivider} />
                      <InfoRow
                        icon="tag"
                        label="Crops"
                        value={user.crops.join(", ")}
                      />
                    </>
                  )}
                  {user.bio && (
                    <>
                      <View style={styles.infoDivider} />
                      <InfoRow icon="file-text" label="Bio" value={user.bio} />
                    </>
                  )}
                  <View style={styles.infoDivider} />
                  <InfoRow
                    icon="calendar"
                    label="Member since"
                    value={new Date(user.joinedDate).toLocaleDateString("en-ZW", {
                      month: "long",
                      year: "numeric",
                    })}
                  />
                </View>
              </View>

              {/* Farmer: My Listings */}
              {user.role === "farmer" && (
                <View style={styles.section}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>My Listings</Text>
                    <Pressable onPress={() => router.push("/product/add")}>
                      <Text style={styles.seeAll}>+ Add New</Text>
                    </Pressable>
                  </View>
                  {myProducts.length === 0 ? (
                    <View style={styles.emptyListings}>
                      <MaterialCommunityIcons
                        name="sprout-outline"
                        size={40}
                        color={Colors.border}
                      />
                      <Text style={styles.emptyText}>No products listed yet</Text>
                      <Pressable
                        style={styles.listBtn}
                        onPress={() => router.push("/product/add")}
                      >
                        <Text style={styles.listBtnText}>List a Product</Text>
                      </Pressable>
                    </View>
                  ) : (
                    myProducts.slice(0, 3).map((p) => (
                      <Pressable
                        key={p.id}
                        style={styles.productRow}
                        onPress={() =>
                          router.push({
                            pathname: "/product/[id]",
                            params: { id: p.id },
                          })
                        }
                      >
                        <View style={styles.productRowIcon}>
                          <MaterialCommunityIcons
                            name="sprout"
                            size={22}
                            color={Colors.primaryLight}
                          />
                        </View>
                        <View style={styles.productRowInfo}>
                          <Text style={styles.productRowName}>{p.name}</Text>
                          <Text style={styles.productRowPrice}>
                            {formatPriceWithUnit(p.price, p.unit)}
                          </Text>
                        </View>
                        <Feather
                          name="chevron-right"
                          size={18}
                          color={Colors.textMuted}
                        />
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}

          {/* Settings & Logout */}
          {!editing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <View style={styles.infoCard}>
                {/* Farmer-specific settings */}
                {user.role === "farmer" && (
                  <>
                    <Pressable
                      style={styles.settingsRow}
                      onPress={() => router.push("/(tabs)/advisory")}
                    >
                      <View style={[styles.settingsIcon, { backgroundColor: "#EFF6FF" }]}>
                        <Ionicons name="sunny" size={18} color="#2563EB" />
                      </View>
                      <Text style={styles.settingsText}>Crop Advisory</Text>
                      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                    </Pressable>
                    <View style={styles.infoDivider} />
                    <Pressable style={styles.settingsRow} onPress={() => router.push("/(tabs)/map")}>
                      <View style={[styles.settingsIcon, { backgroundColor: "#FEF3E9" }]}>
                        <Feather name="map" size={18} color={Colors.accent} />
                      </View>
                      <Text style={styles.settingsText}>Find Farmers</Text>
                      <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                    </Pressable>
                    <View style={styles.infoDivider} />
                  </>
                )}
                
                {/* Common settings for all users */}
                <Pressable style={styles.settingsRow} onPress={() => router.push("/(tabs)/marketplace")}>
                  <View style={[styles.settingsIcon, { backgroundColor: "#F0FDF4" }]}>
                    <Ionicons name="storefront" size={18} color="#16A34A" />
                  </View>
                  <Text style={styles.settingsText}>Marketplace</Text>
                  <Feather name="chevron-right" size={18} color={Colors.textMuted} />
                </Pressable>
                <View style={styles.infoDivider} />
                <Pressable style={styles.settingsRow} onPress={handleLogout}>
                  <View style={[styles.settingsIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Feather name="log-out" size={18} color={Colors.error} />
                  </View>
                  <Text style={[styles.settingsText, { color: Colors.error }]}>
                    Sign Out
                  </Text>
                  <Feather name="chevron-right" size={18} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StatBox({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statBox}>
      <Feather name={icon} size={16} color="rgba(255,255,255,0.7)" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={Colors.primary} />
      <View style={styles.infoRowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function EditField({
  label,
  icon,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name={icon} size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? "default"}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 16,
  },
  heroContent: {
    flex: 1,
    justifyContent: "flex-start",
  },
  heroRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  heroName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  editingIndicator: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  editingText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  roleFarmer: { backgroundColor: Colors.farmerBadge },
  roleBuyer: { backgroundColor: Colors.buyerBadge },
  roleDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#ccc" },
  roleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 14,
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statBox: { alignItems: "center", gap: 3 },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  infoRowContent: { flex: 1, gap: 2 },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  infoDivider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: 16 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  textAreaWrap: { height: 90, alignItems: "flex-start", paddingVertical: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  textArea: { textAlignVertical: "top" },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  emptyListings: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  listBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  listBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF7F0",
    justifyContent: "center",
    alignItems: "center",
  },
  productRowInfo: { flex: 1 },
  productRowName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  productRowPrice: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    marginTop: 2,
  },
  editingIndicator: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  editingText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
