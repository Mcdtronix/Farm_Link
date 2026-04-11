#!/usr/bin/env python
"""
Add missing API views for farmer directory and categories
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

def add_missing_views():
    """Add missing views to views.py"""
    
    # Read current views.py file
    with open('tomato_grading_api/views.py', 'r') as f:
        content = f.read()
    
    # Check if views already exist
    if 'CountyListView' in content:
        print("✅ Views already exist")
        return
    
    # New views to add
    new_views = '''

class CountyListView(APIView):
    """List all active counties."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active counties."""
        counties = County.objects.filter(is_active=True)
        serializer = CountySerializer(counties, many=True)
        return Response(serializer.data)


class ProductCategoryListView(APIView):
    """List all active product categories."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active product categories."""
        categories = ProductCategory.objects.filter(is_active=True)
        serializer = ProductCategorySerializer(categories, many=True)
        return Response(serializer.data)


class FarmerDirectoryView(APIView):
    """Farmer directory with search and filtering."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of farmers with optional filtering."""
        queryset = FarmerProfile.objects.select_related('user', 'county').all()
        
        # Filter by county
        county_id = request.query_params.get('county')
        if county_id:
            queryset = queryset.filter(county_id=county_id)
        
        # Filter by crops
        crops = request.query_params.get('crops')
        if crops:
            crop_list = [c.strip() for c in crops.split(',')]
            queryset = queryset.filter(crops__overlap=crop_list)
        
        # Filter by verification status
        verified_only = request.query_params.get('verified', 'false').lower() == 'true'
        if verified_only:
            queryset = queryset.filter(is_verified=True)
        
        # Search by name or location
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(business_name__icontains=search) |
                models.Q(location__icontains=search) |
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search)
            )
        
        # Order by rating by default
        ordering = request.query_params.get('ordering', '-rating')
        queryset = queryset.order_by(ordering)
        
        # Pagination
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = queryset.count()
        farmers = queryset[start:end]
        
        serializer = FarmerProfileListSerializer(farmers, many=True)
        
        return Response({
            'count': total_count,
            'next': page * page_size < total_count,
            'previous': page > 1,
            'results': serializer.data
        })


class FarmerDetailView(APIView):
    """Get detailed farmer profile."""
    permission_classes = [AllowAny]
    
    def get(self, request, pk) -> Response:
        """Get detailed farmer profile by ID."""
        try:
            farmer = FarmerProfile.objects.select_related('user', 'county').get(pk=pk)
            serializer = FarmerProfileSerializer(farmer)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MyFarmerProfileView(APIView):
    """Get or update current user's farmer profile."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request) -> Response:
        """Get current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(profile)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def patch(self, request) -> Response:
        """Update current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(
                profile, data=request.data, partial=True
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(
                serializer.errors, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MarketPriceListView(APIView):
    """List current market prices for tomatoes."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get current market prices with optional filtering."""
        # For now, return mock data structure
        # In production, this would fetch from real market data sources
        mock_prices = [
            {
                'id': 'mp1',
                'crop': 'Tomatoes (Grade A)',
                'category': 'Vegetables',
                'price': 1.8,
                'unit': 'kg',
                'change': 5,
                'change_percent': 6.5,
                'market': 'Mbare Musika (Harare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp2',
                'crop': 'Tomatoes (Grade B)',
                'category': 'Vegetables',
                'price': 1.4,
                'unit': 'kg',
                'change': -3,
                'change_percent': -5.9,
                'market': 'Sakubva Market (Mutare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp3',
                'crop': 'Tomatoes (Grade C)',
                'category': 'Vegetables',
                'price': 1.1,
                'unit': 'kg',
                'change': 2,
                'change_percent': 4.8,
                'market': 'Sakubva & Gweru Markets',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            }
        ]
        
        # Filter by crop if specified
        crop_filter = request.query_params.get('crop')
        if crop_filter:
            mock_prices = [p for p in mock_prices if crop_filter.lower() in p['crop'].lower()]
        
        # Filter by market if specified
        market_filter = request.query_params.get('market')
        if market_filter:
            mock_prices = [p for p in mock_prices if market_filter.lower() in p['market'].lower()]
        
        return Response(mock_prices)
'''
    
    # Append to end of file
    new_content = content + new_views
    
    # Write back to file
    with open('tomato_grading_api/views.py', 'w') as f:
        f.write(new_content)
    
    print("✅ Added missing API views")

if __name__ == "__main__":
    add_missing_views()
