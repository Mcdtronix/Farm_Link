import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/contexts/ProductContext";
import { PRODUCT_CATEGORIES, COUNTIES } from "@/data/mock";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FormData {
  name: string;
  category: string;
  description: string;
  price: string;
  unit: string;
  quantity: string;
  isOrganic: boolean;
  county: string;
}

type FieldErrors = Partial<Record<keyof FormData, string>>;

const UNIT_OPTIONS = ["kg", "gram", "bunch", "piece", "bag (50kg)", "crate", "litre", "dozen"];

function validate(data: FormData): FieldErrors {
  const e: FieldErrors = {};
  if (!data.name.trim()) e.name = "Product name is required";
  else if (data.name.trim().length < 3)
    e.name = "Name must be at least 3 characters";

  if (!data.category || data.category === "All")
    e.category = "Select a category";

  if (!data.description.trim()) e.description = "Description is required";
  else if (data.description.trim().length < 20)
    e.description = "Provide a detailed description (min 20 chars)";

  const priceNum = parseFloat(data.price);
  if (!data.price) e.price = "Price is required";
  else if (isNaN(priceNum) || priceNum <= 0) e.price = "Enter a valid price";
  else if (priceNum > 100000) e.price = "Price seems too high";

  if (!data.unit) e.unit = "Select a unit";

  const qtyNum = parseInt(data.quantity);
  if (!data.quantity) e.quantity = "Quantity is required";
  else if (isNaN(qtyNum) || qtyNum <= 0) e.quantity = "Enter a valid quantity";

  if (!data.county || data.county === "All Counties")
    e.county = "Select your county";

  return e;
}

export default function AddProductScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addProduct } = useProducts();
  const [form, setForm] = useState<FormData>({
    name: "",
    category: "",
    description: "",
    price: "",
    unit: "",
    quantity: "",
    isOrganic: false,
    county: user?.county ?? "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showCountyPicker, setShowCountyPicker] = useState(false);

  const set = (key: keyof FormData) => (val: string | boolean) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow access to photos to upload product images."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take product photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!user) {
      Alert.alert("Login required", "Please login to list a product.");
      return;
    }

    if (user.role !== "farmer") {
      Alert.alert("Farmer only", "Only farmer accounts can list products.");
      return;
    }

    setLoading(true);
    try {
      await addProduct(
        {
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim(),
          price: parseFloat(form.price),
          unit: form.unit,
          quantity: parseInt(form.quantity),
          images,
          isOrganic: form.isOrganic,
          county: form.county,
        },
        user.id,
        user.name,
        user.location
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Your product has been listed!", [
        { text: "View Marketplace", onPress: () => router.replace("/(tabs)/marketplace") },
        { text: "Add Another", onPress: () => router.replace("/product/add") },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to list product. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 60),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Photos</Text>
            <Text style={styles.sectionSub}>Add up to 5 high-quality images</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesRow}
            >
              {images.map((uri, idx) => (
                <View key={idx} style={styles.imageWrap}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  <Pressable
                    style={styles.removeImg}
                    onPress={() => removeImage(idx)}
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {images.length < 5 && (
                <View style={styles.addImgBtns}>
                  <Pressable style={styles.addImgBtn} onPress={pickImage}>
                    <Feather name="image" size={24} color={Colors.primary} />
                    <Text style={styles.addImgText}>Gallery</Text>
                  </Pressable>
                  {Platform.OS !== "web" && (
                    <Pressable style={styles.addImgBtn} onPress={takePhoto}>
                      <Feather name="camera" size={24} color={Colors.accent} />
                      <Text style={styles.addImgTextAccent}>Camera</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </View>

          {/* Product Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Information</Text>

            <InputField
              label="Product Name"
              icon="tag"
              value={form.name}
              onChangeText={set("name") as (v: string) => void}
              placeholder="e.g. Fresh Organic Tomatoes"
              error={errors.name}
            />

            {/* Category Picker */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Category</Text>
              <Pressable
                style={[styles.inputWrap, errors.category ? styles.inputError : null]}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Feather name="layers" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.inputText, !form.category && { color: Colors.textMuted }]}>
                  {form.category || "Select category"}
                </Text>
                <Feather name="chevron-down" size={18} color={Colors.textMuted} />
              </Pressable>
              {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
            </View>

            {/* Description */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Description</Text>
              <View style={[styles.inputWrap, styles.textAreaWrap, errors.description ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.description}
                  onChangeText={(v) => {
                    set("description")(v);
                  }}
                  placeholder="Describe your product: quality, origin, growing method..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>
              {errors.description ? <Text style={styles.fieldError}>{errors.description}</Text> : null}
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing & Quantity</Text>

            <View style={styles.rowFields}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Price (USD)</Text>
                <View style={[styles.inputWrap, errors.price ? styles.inputError : null]}>
                  <Text style={styles.currencySymbol}>USD</Text>
                  <TextInput
                    style={styles.input}
                    value={form.price}
                    onChangeText={set("price") as (v: string) => void}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                {errors.price ? <Text style={styles.fieldError}>{errors.price}</Text> : null}
              </View>

              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Unit</Text>
                <Pressable
                  style={[styles.inputWrap, errors.unit ? styles.inputError : null]}
                  onPress={() => setShowUnitPicker(true)}
                >
                  <Text style={[styles.inputText, !form.unit && { color: Colors.textMuted }]}>
                    {form.unit || "per..."}
                  </Text>
                  <Feather name="chevron-down" size={18} color={Colors.textMuted} />
                </Pressable>
                {errors.unit ? <Text style={styles.fieldError}>{errors.unit}</Text> : null}
              </View>
            </View>

            <InputField
              label="Available Quantity"
              icon="package"
              value={form.quantity}
              onChangeText={set("quantity") as (v: string) => void}
              placeholder="e.g. 500"
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>

          {/* Location & Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Details</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>County</Text>
              <Pressable
                style={[styles.inputWrap, errors.county ? styles.inputError : null]}
                onPress={() => setShowCountyPicker(true)}
              >
                <Feather name="map-pin" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
                <Text style={[styles.inputText, !form.county && { color: Colors.textMuted }]}>
                  {form.county || "Select county"}
                </Text>
                <Feather name="chevron-down" size={18} color={Colors.textMuted} />
              </Pressable>
              {errors.county ? <Text style={styles.fieldError}>{errors.county}</Text> : null}
            </View>

            {/* Organic Toggle */}
            <Pressable
              style={styles.organicToggle}
              onPress={() => set("isOrganic")(!form.isOrganic)}
            >
              <View style={styles.organicLeft}>
                <View style={[styles.organicIcon, form.isOrganic && { backgroundColor: "#D1FAE5" }]}>
                  <MaterialCommunityIcons
                    name="leaf"
                    size={20}
                    color={form.isOrganic ? Colors.primary : Colors.textMuted}
                  />
                </View>
                <View>
                  <Text style={styles.organicLabel}>Organic Product</Text>
                  <Text style={styles.organicDesc}>
                    Grown without synthetic pesticides
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.toggle,
                  form.isOrganic && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    form.isOrganic && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </Pressable>
          </View>

          {/* Submit */}
          <View style={styles.submitSection}>
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="storefront" size={20} color="#fff" />
                  <Text style={styles.submitText}>List Product</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>

        {/* Pickers */}
        {showCategoryPicker && (
          <PickerSheet
            title="Select Category"
            options={PRODUCT_CATEGORIES.filter((c) => c !== "All")}
            selected={form.category}
            onSelect={(v) => { set("category")(v); setShowCategoryPicker(false); }}
            onClose={() => setShowCategoryPicker(false)}
            insets={insets.bottom}
          />
        )}
        {showUnitPicker && (
          <PickerSheet
            title="Select Unit"
            options={UNIT_OPTIONS}
            selected={form.unit}
            onSelect={(v) => { set("unit")(v); setShowUnitPicker(false); }}
            onClose={() => setShowUnitPicker(false)}
            insets={insets.bottom}
          />
        )}
        {showCountyPicker && (
          <PickerSheet
            title="Select County"
            options={COUNTIES.filter((c) => c !== "All Counties")}
            selected={form.county}
            onSelect={(v) => { set("county")(v); setShowCountyPicker(false); }}
            onClose={() => setShowCountyPicker(false)}
            insets={insets.bottom}
          />
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

function InputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <Feather name={icon} size={18} color={error ? Colors.error : Colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? "default"}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PickerSheet({
  title,
  options,
  selected,
  onSelect,
  onClose,
  insets,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  insets: number;
}) {
  return (
    <Pressable style={pickerStyles.overlay} onPress={onClose}>
      <View style={[pickerStyles.sheet, { paddingBottom: insets + 16 }]}>
        <View style={pickerStyles.handle} />
        <Text style={pickerStyles.title}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              style={[pickerStyles.item, selected === opt && pickerStyles.itemActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[pickerStyles.itemText, selected === opt && pickerStyles.itemTextActive]}>
                {opt}
              </Text>
              {selected === opt && <Feather name="check" size={16} color={Colors.primary} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Pressable>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: 450,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 14,
    textAlign: "center",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemActive: {
    backgroundColor: "#F0F9F4",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  itemText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  itemTextActive: { color: Colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 8 },
  section: { gap: 14, marginBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: -10,
  },
  imagesRow: { gap: 12, paddingVertical: 4 },
  imageWrap: { position: "relative" },
  imageThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImg: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  addImgBtns: { flexDirection: "row", gap: 10 },
  addImgBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
  },
  addImgText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  addImgTextAccent: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  fieldWrap: { gap: 6 },
  label: {
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
  },
  textAreaWrap: { height: 100, alignItems: "flex-start", paddingVertical: 14 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  textArea: { textAlignVertical: "top" },
  inputError: { borderColor: Colors.error },
  fieldError: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  currencySymbol: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    marginRight: 6,
  },
  rowFields: { flexDirection: "row", gap: 12 },
  organicToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  organicLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  organicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  organicLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  organicDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 1,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: { alignSelf: "flex-end" },
  submitSection: { marginTop: 12 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
});
