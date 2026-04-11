export type UserRole = "farmer" | "buyer";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  location: string;
  county: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  joinedDate: string;
  farmSize?: string;
  crops?: string[];
  rating?: number;
  totalSales?: number;
  coordinates?: { lat: number; lng: number };
}

export interface Product {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerLocation: string;
  farmerAvatar?: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  images: string[];
  rating: number;
  reviews: number;
  isOrganic: boolean;
  harvestDate: string;
  listedDate: string;
  county: string;
  coordinates: { lat: number; lng: number };
}

export interface MarketPrice {
  id: string;
  crop: string;
  category: string;
  price: number;
  unit: string;
  change: number;
  changePercent: number;
  market: string;
  date: string;
}

export interface Advisory {
  id: string;
  title: string;
  category: "grading" | "pricing" | "market" | "quality" | "tips";
  description: string;
  urgency: "low" | "medium" | "high";
  crops: string[];
  region: string;
  validFrom: string;
  validTo: string;
  recommendation: string;
  source: string;
}

export interface FarmerLocation {
  id: string;
  name: string;
  location: string;
  county: string;
  crops: string[];
  rating: number;
  distance: number;
  isVerified: boolean;
  phone: string;
  coordinates: { lat: number; lng: number };
  avatar?: string;
  activeListings: number;
}

export const MOCK_FARMERS: FarmerLocation[] = [
  {
    id: "f1",
    name: "Tendai Ncube",
    location: "Mbare, Harare",
    county: "Harare",
    crops: ["Tomatoes", "Cabbages", "Kale"],
    rating: 4.8,
    distance: 2.4,
    isVerified: true,
    phone: "+263 71 234 5678",
    coordinates: { lat: -17.865, lng: 31.0506 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=james",
    activeListings: 5,
  },
  {
    id: "f2",
    name: "Rufaro Moyo",
    location: "Sakubva, Mutare",
    county: "Manicaland",
    crops: ["Tomatoes", "Onions", "Leafy greens"],
    rating: 4.6,
    distance: 4.1,
    isVerified: true,
    phone: "+263 77 345 6789",
    coordinates: { lat: -18.9707, lng: 32.6709 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=grace",
    activeListings: 3,
  },
  {
    id: "f3",
    name: "Brighton Dube",
    location: "Mkoba, Gweru",
    county: "Midlands",
    crops: ["Tomatoes", "Cabbages", "Green peppers"],
    rating: 4.5,
    distance: 6.8,
    isVerified: false,
    phone: "+263 71 456 7890",
    coordinates: { lat: -19.458, lng: 29.8167 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=peter",
    activeListings: 7,
  },
  {
    id: "f4",
    name: "Nyasha Chikomo",
    location: "Chitungwiza",
    county: "Harare",
    crops: ["Tomatoes", "Spinach", "Covo"],
    rating: 4.9,
    distance: 9.2,
    isVerified: true,
    phone: "+263 78 456 7890",
    coordinates: { lat: -18.0127, lng: 31.0756 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=mary",
    activeListings: 4,
  },
  {
    id: "f5",
    name: "Tatenda Mhlanga",
    location: "Masvingo",
    county: "Masvingo",
    crops: ["Tomatoes", "Onions", "Butternut"],
    rating: 4.3,
    distance: 12.5,
    isVerified: true,
    phone: "+263 77 567 8901",
    coordinates: { lat: -20.0637, lng: 30.8271 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=samuel",
    activeListings: 2,
  },
  {
    id: "f6",
    name: "Rudo Chirwa",
    location: "Nkulumane, Bulawayo",
    county: "Bulawayo",
    crops: ["Tomatoes", "Maize", "Leafy greens"],
    rating: 4.7,
    distance: 15.3,
    isVerified: true,
    phone: "+263 71 678 9012",
    coordinates: { lat: -20.17, lng: 28.58 },
    avatar: "https://api.dicebear.com/7.x/avataaars/png?seed=faith",
    activeListings: 6,
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    farmerId: "f1",
    farmerName: "Tendai Ncube",
    farmerLocation: "Mbare, Harare",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=tendai",
    name: "Fresh Organic Tomatoes (Zimbabwe Grade A)",
    category: "Vegetables",
    description:
      "Vine-ripened organic tomatoes grown without pesticides. Perfect for cooking and salads. Harvested fresh from our Limuru farm.",
    price: 1.5,
    unit: "kg",
    quantity: 500,
    images: [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800",
      "https://images.unsplash.com/photo-1546094096-0df4bcabd337?w=800",
    ],
    rating: 4.8,
    reviews: 42,
    isOrganic: true,
    harvestDate: "2026-03-04",
    listedDate: "2026-03-05",
    county: "Harare",
    coordinates: { lat: -17.865, lng: 31.0506 },
  },
  {
    id: "p2",
    farmerId: "f2",
    farmerName: "Rufaro Moyo",
    farmerLocation: "Sakubva, Mutare",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=rufaro",
    name: "Tomatoes for Mbare Musika (Grade B)",
    category: "Vegetables",
    description:
      "Freshly harvested basmati rice from the fertile shores of Lake Victoria. Long grain, aromatic, and fluffy when cooked.",
    price: 1.1,
    unit: "kg",
    quantity: 1500,
    images: [
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800",
      "https://images.unsplash.com/photo-1536304993881-ff86e0c9c9ef?w=800",
    ],
    rating: 4.6,
    reviews: 28,
    isOrganic: false,
    harvestDate: "2026-02-28",
    listedDate: "2026-03-01",
    county: "Manicaland",
    coordinates: { lat: -18.9707, lng: 32.6709 },
  },
  {
    id: "p3",
    farmerId: "f3",
    farmerName: "Brighton Dube",
    farmerLocation: "Mkoba, Gweru",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=brighton",
    name: "Tomatoes (Greenhouse Grade A)",
    category: "Vegetables",
    description:
      "High-grade Irish potatoes from the fertile Nakuru highlands. Uniform size, clean skin, ideal for all cooking methods.",
    price: 1.8,
    unit: "kg",
    quantity: 3200,
    images: [
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800",
      "https://images.unsplash.com/photo-1596096559957-5853e9f2fa46?w=800",
    ],
    rating: 4.5,
    reviews: 67,
    isOrganic: false,
    harvestDate: "2026-03-01",
    listedDate: "2026-03-02",
    county: "Midlands",
    coordinates: { lat: -19.458, lng: 29.8167 },
  },
  {
    id: "p4",
    farmerId: "f4",
    farmerName: "Nyasha Chikomo",
    farmerLocation: "Chitungwiza",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=nyasha",
    name: "Tomatoes (Field Mix Grade C)",
    category: "Vegetables",
    description:
      "Sweet, juicy pineapples from Thika's renowned farms. Rich in vitamin C, perfect for fresh consumption and juice making.",
    price: 0.9,
    unit: "kg",
    quantity: 900,
    images: [
      "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800",
      "https://images.unsplash.com/photo-1589820296156-2454bb8a6ad1?w=800",
    ],
    rating: 4.9,
    reviews: 89,
    isOrganic: true,
    harvestDate: "2026-03-03",
    listedDate: "2026-03-04",
    county: "Harare",
    coordinates: { lat: -18.0127, lng: 31.0756 },
  },
  {
    id: "p5",
    farmerId: "f1",
    farmerName: "Tendai Ncube",
    farmerLocation: "Mbare, Harare",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=tendai",
    name: "Tomato Seedlings (Open Field)",
    category: "Seedlings",
    description:
      "Tender, nutrient-rich kale harvested this morning. A staple green vegetable packed with iron and vitamins.",
    price: 15,
    unit: "tray",
    quantity: 250,
    images: [
      "https://images.unsplash.com/photo-1612966809401-2f8b6e37a4af?w=800",
    ],
    rating: 4.7,
    reviews: 34,
    isOrganic: true,
    harvestDate: "2026-03-06",
    listedDate: "2026-03-06",
    county: "Harare",
    coordinates: { lat: -17.865, lng: 31.0506 },
  },
  {
    id: "p6",
    farmerId: "f6",
    farmerName: "Rudo Chirwa",
    farmerLocation: "Nkulumane, Bulawayo",
    farmerAvatar: "https://api.dicebear.com/7.x/avataaars/png?seed=rudo",
    name: "Tomato Boxes (Bulk for Wholesale)",
    category: "Vegetables",
    description:
      "Stone-milled whole wheat flour from organically grown wheat. High protein content, perfect for bread and chapati.",
    price: 14,
    unit: "box",
    quantity: 600,
    images: [
      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800",
    ],
    rating: 4.7,
    reviews: 51,
    isOrganic: false,
    harvestDate: "2026-02-20",
    listedDate: "2026-02-25",
    county: "Bulawayo",
    coordinates: { lat: -20.17, lng: 28.58 },
  },
];

export const MOCK_MARKET_PRICES: MarketPrice[] = [
  {
    id: "mp1",
    crop: "Tomatoes (Grade A)",
    category: "Vegetables",
    price: 1.8,
    unit: "kg",
    change: 5,
    changePercent: 6.5,
    market: "Mbare Musika (Harare)",
    date: "2026-03-06",
  },
  {
    id: "mp2",
    crop: "Tomatoes (Grade B)",
    category: "Vegetables",
    price: 1.4,
    unit: "kg",
    change: -3,
    changePercent: -5.9,
    market: "Sakubva Market (Mutare)",
    date: "2026-03-06",
  },
  {
    id: "mp3",
    crop: "Tomatoes (Grade C)",
    category: "Vegetables",
    price: 1.1,
    unit: "kg",
    change: 2,
    changePercent: 4.8,
    market: "Sakubva & Gweru Markets",
    date: "2026-03-06",
  },
  {
    id: "mp4",
    crop: "Tomatoes (Greenhouse Premium)",
    category: "Vegetables",
    price: 2.2,
    unit: "kg",
    change: 0.2,
    changePercent: 10.5,
    market: "Bulawayo & Harare Supermarkets",
    date: "2026-03-06",
  },
  {
    id: "mp5",
    crop: "Tomatoes (Processing Grade)",
    category: "Vegetables",
    price: 0.9,
    unit: "kg",
    change: 0,
    changePercent: 0,
    market: "Masvingo & Chiredzi",
    date: "2026-03-06",
  },
  {
    id: "mp6",
    crop: "Tomato Seedlings (tray)",
    category: "Seedlings",
    price: 14,
    unit: "tray",
    change: 1,
    changePercent: 7.7,
    market: "Harare Nurseries",
    date: "2026-03-06",
  },
  {
    id: "mp7",
    crop: "Tomatoes (Undersize Mix)",
    category: "Vegetables",
    price: 0.7,
    unit: "kg",
    change: 7,
    changePercent: 12.1,
    market: "High-density Markets (Harare)",
    date: "2026-03-06",
  },
  {
    id: "mp8",
    crop: "Tomatoes (Damaged/Seconds)",
    category: "Vegetables",
    price: 0.4,
    unit: "kg",
    change: -0.1,
    changePercent: -8.5,
    market: "Processing Buyers",
    date: "2026-03-06",
  },
];

export const MOCK_ADVISORIES: Advisory[] = [
  {
    id: "a1",
    title: "Tomato Grading Guide – Zimbabwe Export Standards",
    category: "grading",
    description:
      "Use this quick visual guide to separate tomatoes into Grade A, B and C according to major Zimbabwean wholesale and export buyers.",
    urgency: "high",
    crops: ["Tomatoes"],
    region: "Harare, Bulawayo & major corridors",
    validFrom: "2026-03-06",
    validTo: "2026-03-20",
    recommendation:
      "Sort by size, firmness and colour. Grade A: uniform size, firm, deep red, no cracks; Grade B: minor shape defects; Grade C: soft or blemished for processing only.",
    source: "Zimbabwe Agricultural Marketing Authority (ZAMA)",
  },
  {
    id: "a2",
    title: "Dynamic Tomato Price Bands (USD)",
    category: "pricing",
    description:
      "Live price bands for tomato Grades A–C across key Zimbabwean markets based on recent transactions.",
    urgency: "high",
    crops: ["Tomatoes"],
    region: "Harare, Bulawayo, Mutare, Gweru",
    validFrom: "2026-03-05",
    validTo: "2026-03-15",
    recommendation:
      "Grade A: 1.8–2.3 USD/kg, Grade B: 1.2–1.6 USD/kg, Grade C: 0.6–1.0 USD/kg. Use lower end for bulk loads and oversupply days, upper end for shortage days.",
    source: "Farm-Link AI Tomato Pricing Model",
  },
  {
    id: "a3",
    title: "Best Markets for Tomato Grade A Today",
    category: "market",
    description:
      "Demand for Grade A tomatoes is strongest in Mbare Musika and Bulawayo CBD this week based on buyer order volumes.",
    urgency: "medium",
    crops: ["Tomatoes"],
    region: "Harare, Bulawayo",
    validFrom: "2026-03-06",
    validTo: "2026-04-15",
    recommendation:
      "If you are within 150km of Harare, prioritise Mbare Musika. For southern regions, target Bulawayo CBD buyers offering premiums for uniform crates.",
    source: "Farm-Link AI Market Analysis",
  },
  {
    id: "a4",
    title: "Quality Checklist Before You List Tomatoes",
    category: "quality",
    description:
      "Simple checks to run through before listing your tomatoes on Farm-Link AI to reduce buyer complaints and rejections.",
    urgency: "medium",
    crops: ["Tomatoes"],
    region: "Zimbabwe tomato belts",
    validFrom: "2026-03-01",
    validTo: "2026-03-31",
    recommendation:
      "Remove damaged fruits, clean mud from crates, avoid overfilled boxes, and keep produce shaded. Upload clear photos that show colour and size clearly.",
    source: "Farm-Link AI Quality Playbook",
  },
  {
    id: "a5",
    title: "Tips to Get Better Tomato Grades",
    category: "tips",
    description:
      "Small handling improvements can easily upgrade many tomatoes from Grade C to Grade B and increase your earnings.",
    urgency: "low",
    crops: ["Tomatoes"],
    region: "All tomato regions",
    validFrom: "2026-03-06",
    validTo: "2026-03-27",
    recommendation:
      "Harvest in the cool hours of the day, avoid rough handling, and never stack wet tomatoes. Use crates instead of sacks to maintain firmness and shape.",
    source: "Zimbabwe Horticulture Experts & Farm-Link AI",
  },
];

export const PRODUCT_CATEGORIES = [
  "All",
  "Vegetables",
  "Fruits",
  "Grains",
  "Legumes",
  "Dairy",
  "Poultry",
  "Livestock",
  "Seedlings",
];

export const COUNTIES = [
  "All Counties",
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Midlands",
  "Masvingo",
  "Mashonaland East",
  "Mashonaland West",
  "Mashonaland Central",
  "Matabeleland North",
  "Matabeleland South",
];
