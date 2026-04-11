# AgriLink - AI-Powered Market Linkage Platform

## Overview
A React Native / Expo mobile application connecting smallholder farmers and buyers in Kenya. Features AI-powered crop advisory, product listings with image upload, geolocation-based farmer discovery, and live market pricing.

## Architecture

### Frontend (Expo Router)
- `app/_layout.tsx` — Root layout with all providers
- `app/index.tsx` — Auth redirect logic
- `app/(auth)/` — Auth flow: welcome, login, register
- `app/(tabs)/` — Main tab navigation (Home, Marketplace, Advisory, Map, Profile)
- `app/product/[id].tsx` — Product detail screen
- `app/product/add.tsx` — Add product listing (farmers only)

### State & Data
- `contexts/AuthContext.tsx` — Auth state with AsyncStorage persistence
- `contexts/ProductContext.tsx` — Product listings with AsyncStorage
- `data/mock.ts` — Mock data: farmers, products, market prices, advisories

### Backend (Express)
- `server/index.ts` — Express server (port 5000)
- `server/routes.ts` — API routes (minimal, app is mostly frontend)

## Features
1. **Auth System** — Farmer/Buyer registration with full validation, AsyncStorage persistence
2. **Home Dashboard** — Live market prices, quick actions by role
3. **Marketplace** — Browse/search/filter products, price board
4. **Crop Advisory** — AI-powered seasonal advisory cards with urgency levels
5. **Farmer Map** — Find farmers by location, open Google Maps, call
6. **Product Listing** — Upload with camera/gallery, full validation
7. **Profile** — Edit profile, view own listings, role-specific stats

## Color Theme
- Primary: #2D6A4F (Forest Green)
- Accent: #F4A261 (Warm Amber)
- Background: #F7F5F0 (Warm Off-White)

## Demo Accounts
- Farmer: `farmer@demo.com` / `demo123`
- Buyer: `buyer@demo.com` / `demo123`

## Tech Stack
- Expo SDK 53, React Native
- Expo Router (file-based routing)
- AsyncStorage (local persistence)
- expo-image-picker (product photos)
- expo-location (farmer map)
- expo-linear-gradient (UI gradients)
- @expo/vector-icons (Feather, Ionicons, MaterialCommunityIcons)
- @tanstack/react-query
- TypeScript
