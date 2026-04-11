/**
 * Safely formats price values for display
 * Handles both string and number inputs from API responses
 */

export const formatPrice = (price: string | number, decimals: number = 2): string => {
  if (price === null || price === undefined || price === '') {
    return '0.00';
  }
  
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    console.warn('Invalid price value:', price);
    return '0.00';
  }
  
  return numPrice.toFixed(decimals);
};

export const formatPriceWithUnit = (price: string | number, unit: string, decimals: number = 2): string => {
  const formattedPrice = formatPrice(price, decimals);
  return `USD ${formattedPrice}/${unit}`;
};

export const parsePrice = (price: string | number): number => {
  if (price === null || price === undefined || price === '') {
    return 0;
  }
  
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    console.warn('Invalid price value for parsing:', price);
    return 0;
  }
  
  return numPrice;
};
