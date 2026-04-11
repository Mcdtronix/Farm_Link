#!/usr/bin/env python
"""
Populate database with initial counties and categories data
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from tomato_grading_api.models import County, ProductCategory

def populate_counties():
    """Populate counties with Zimbabwe administrative divisions"""
    counties_data = [
        {'name': 'Harare', 'code': 'HR'},
        {'name': 'Bulawayo', 'code': 'BY'},
        {'name': 'Manicaland', 'code': 'ML'},
        {'name': 'Midlands', 'code': 'MD'},
        {'name': 'Masvingo', 'code': 'MV'},
        {'name': 'Mashonaland East', 'code': 'ME'},
        {'name': 'Mashonaland West', 'code': 'MW'},
        {'name': 'Mashonaland Central', 'code': 'MC'},
        {'name': 'Matabeleland North', 'code': 'MN'},
        {'name': 'Matabeleland South', 'code': 'MS'},
    ]
    
    created_count = 0
    for county_data in counties_data:
        county, created = County.objects.get_or_create(
            name=county_data['name'],
            code=county_data['code'],
            defaults={'is_active': True}
        )
        if created:
            created_count += 1
            print(f"✅ Created county: {county.name}")
        else:
            print(f"ℹ️  County already exists: {county.name}")
    
    print(f"📊 Counties populated: {created_count} new, {len(counties_data) - created_count} existing")

def populate_categories():
    """Populate product categories"""
    categories_data = [
        {'name': 'Vegetables', 'description': 'Fresh vegetables including tomatoes, cabbages, etc.'},
        {'name': 'Fruits', 'description': 'Fresh fruits and seasonal produce'},
        {'name': 'Grains', 'description': 'Cereals and grains like maize, wheat, rice'},
        {'name': 'Legumes', 'description': 'Beans, peas, lentils and other legumes'},
        {'name': 'Dairy', 'description': 'Milk, cheese, yogurt and dairy products'},
        {'name': 'Poultry', 'description': 'Chicken, eggs and other poultry products'},
        {'name': 'Livestock', 'description': 'Cattle, goats, sheep and other livestock'},
        {'name': 'Seedlings', 'description': 'Plant seedlings and agricultural inputs'},
    ]
    
    created_count = 0
    for category_data in categories_data:
        category, created = ProductCategory.objects.get_or_create(
            name=category_data['name'],
            defaults={
                'description': category_data['description'],
                'is_active': True
            }
        )
        if created:
            created_count += 1
            print(f"✅ Created category: {category.name}")
        else:
            print(f"ℹ️  Category already exists: {category.name}")
    
    print(f"📊 Categories populated: {created_count} new, {len(categories_data) - created_count} existing")

def main():
    """Main function to populate all data"""
    print("🌱 Farm-Link AI - Data Population Script")
    print("=" * 50)
    
    try:
        print("\n📍 Populating Counties...")
        populate_counties()
        
        print("\n🏷️  Populating Product Categories...")
        populate_categories()
        
        print("\n✅ Data population completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during data population: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
