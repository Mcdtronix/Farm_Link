import React, { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useProducts, type NewProductData } from '../../../contexts/ProductContext';
import { useAuth } from '../../../contexts/AuthContext';
import { type Product } from '../../data/mock';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert as RNAlert, Image, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { updateProduct, getProductsByFarmer } = useProducts();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    unit: '',
    quantity: '',
    isOrganic: false,
    county: '',
  });

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = useCallback(async () => {
    try {
      const farmerProducts = getProductsByFarmer(user?.id || '');
      const foundProduct = farmerProducts.find(p => p.id === id);
      
      if (foundProduct) {
        setProduct(foundProduct);
        setForm({
          name: foundProduct.name,
          category: foundProduct.category,
          description: foundProduct.description,
          price: foundProduct.price.toString(),
          unit: foundProduct.unit,
          quantity: foundProduct.quantity.toString(),
          isOrganic: foundProduct.is_organic,
          county: foundProduct.county,
        });
        setImages(foundProduct.images || []);
      } else {
        RNAlert.alert('Error', 'Product not found');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load product:', error);
      RNAlert.alert('Error', 'Failed to load product');
    }
  }, [id, user, getProductsByFarmer]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImages(prev => [...prev, result.assets[0].uri]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      RNAlert.alert('Error', 'Failed to pick image');
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!form.name.trim()) errors.name = 'Product name is required';
    if (!form.category.trim()) errors.category = 'Category is required';
    if (!form.description.trim()) errors.description = 'Description is required';
    if (!form.price || isNaN(parseFloat(form.price))) errors.price = 'Valid price is required';
    if (!form.unit.trim()) errors.unit = 'Unit is required';
    if (!form.quantity || isNaN(parseInt(form.quantity))) errors.quantity = 'Valid quantity is required';
    if (!form.county.trim()) errors.county = 'County is required';
    
    return errors;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!user || user.role !== 'farmer') {
      RNAlert.alert('Access Denied', 'Only farmers can edit products');
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      RNAlert.alert('Validation Error', Object.values(errors).join('\n'));
      return;
    }

    setLoading(true);
    
    try {
      await updateProduct(id, {
        ...form,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
        isOrganic: form.isOrganic,
        images,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      RNAlert.alert('Success', 'Product updated successfully!', [
        { text: 'View Product', onPress: () => router.replace(`/product/${id}`) },
        { text: 'Continue Editing', onPress: () => router.replace(`/product/edit/${id}`) },
      ]);
    } catch (error: any) {
      console.error('Update failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      RNAlert.alert('Error', error.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  }, [user, id, form, images, updateProduct]);

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading product...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Product</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(text) => setForm(prev => ({ ...prev, name: text }))}
            placeholder="Enter product name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category *</Text>
          <TextInput
            style={styles.input}
            value={form.category}
            onChangeText={(text) => setForm(prev => ({ ...prev, category: text }))}
            placeholder="e.g., Tomatoes, Vegetables"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(text) => setForm(prev => ({ ...prev, description: text }))}
            placeholder="Describe your product..."
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.label}>Price ($) *</Text>
            <TextInput
              style={styles.input}
              value={form.price}
              onChangeText={(text) => setForm(prev => ({ ...prev, price: text }))}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.label}>Unit *</Text>
            <TextInput
              style={styles.input}
              value={form.unit}
              onChangeText={(text) => setForm(prev => ({ ...prev, unit: text }))}
              placeholder="e.g., kg, bunch"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              value={form.quantity}
              onChangeText={(text) => setForm(prev => ({ ...prev, quantity: text }))}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.label}>County *</Text>
            <TextInput
              style={styles.input}
              value={form.county}
              onChangeText={(text) => setForm(prev => ({ ...prev, county: text }))}
              placeholder="Your county"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Organic</Text>
            <Switch
              value={form.isOrganic}
              onValueChange={(value) => setForm(prev => ({ ...prev, isOrganic: value }))}
              trackColor={{ true: '#28a745', false: '#ccc' }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Product Images</Text>
          <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
            <Ionicons name="camera" size={24} color="#007AFF" />
            <Text style={styles.imageButtonText}>Add Image</Text>
          </TouchableOpacity>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Updating...' : 'Update Product'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  half: {
    width: '48%',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
  },
  imageButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  imageContainer: {
    marginRight: 10,
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
