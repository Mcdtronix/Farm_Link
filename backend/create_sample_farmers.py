#!/usr/bin/env python
"""
Populate database with sample farmers for testing the farmer directory/map functionality
"""

import os
import sys
import django
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from tomato_grading_api.models import County, FarmerProfile

User = get_user_model()

def create_sample_farmers():
    """Create sample farmers with different locations and contact details"""

    # Sample farmer data
    farmers_data = [
        {
            'username': 'john_farmer',
            'email': 'john.farmer@example.com',
            'first_name': 'John',
            'last_name': 'Moyo',
            'business_name': 'Moyo Tomato Farm',
            'location': 'Chitungwiza, Harare Province',
            'county_name': 'Harare',
            'crops': ['Tomatoes', 'Cabbages', 'Onions'],
            'business_phone': '+263 77 123 4567',
            'business_email': 'contact@moyotomatoes.co.zw',
            'farm_size': '5 hectares',
            'coordinates': Point(31.0530, -17.8292),  # Harare coordinates
            'rating': 4.8,
            'total_reviews': 23,
            'is_verified': True,
        },
        {
            'username': 'mary_green',
            'email': 'mary.green@example.com',
            'first_name': 'Mary',
            'last_name': 'Green',
            'business_name': 'Green Valley Farms',
            'location': 'Masvingo Town',
            'county_name': 'Masvingo',
            'crops': ['Tomatoes', 'Maize', 'Potatoes'],
            'business_phone': '+263 78 234 5678',
            'business_email': 'info@greenvalleyfarms.co.zw',
            'farm_size': '8 hectares',
            'coordinates': Point(30.8278, -20.0637),  # Masvingo coordinates
            'rating': 4.6,
            'total_reviews': 18,
            'is_verified': True,
        },
        {
            'username': 'peter_organic',
            'email': 'peter.organic@example.com',
            'first_name': 'Peter',
            'last_name': 'Ndlovu',
            'business_name': 'Organic Harvest Co.',
            'location': 'Bulawayo Central',
            'county_name': 'Bulawayo',
            'crops': ['Organic Tomatoes', 'Lettuce', 'Carrots'],
            'business_phone': '+263 71 345 6789',
            'business_email': 'sales@organicharvest.co.zw',
            'farm_size': '3 hectares',
            'coordinates': Point(28.5817, -20.1325),  # Bulawayo coordinates
            'rating': 4.9,
            'total_reviews': 31,
            'is_verified': True,
        },
        {
            'username': 'sarah_fresh',
            'email': 'sarah.fresh@example.com',
            'first_name': 'Sarah',
            'last_name': 'Chirawu',
            'business_name': 'Fresh Produce Hub',
            'location': 'Mutare Business Centre',
            'county_name': 'Manicaland',
            'crops': ['Tomatoes', 'Peppers', 'Eggplant'],
            'business_phone': '+263 73 456 7890',
            'business_email': 'orders@freshproducehub.co.zw',
            'farm_size': '6 hectares',
            'coordinates': Point(32.6748, -18.9707),  # Mutare coordinates
            'rating': 4.4,
            'total_reviews': 15,
            'is_verified': False,
        },
        {
            'username': 'david_quality',
            'email': 'david.quality@example.com',
            'first_name': 'David',
            'last_name': 'Sibanda',
            'business_name': 'Quality Tomatoes Ltd',
            'location': 'Gweru Industrial Area',
            'county_name': 'Midlands',
            'crops': ['Premium Tomatoes', 'Cucumbers'],
            'business_phone': '+263 74 567 8901',
            'business_email': 'david@qualitytomatoes.co.zw',
            'farm_size': '10 hectares',
            'coordinates': Point(29.8148, -19.4500),  # Gweru coordinates
            'rating': 4.7,
            'total_reviews': 27,
            'is_verified': True,
        },
        {
            'username': 'grace_family',
            'email': 'grace.family@example.com',
            'first_name': 'Grace',
            'last_name': 'Moyo',
            'business_name': 'Family Farm Produce',
            'location': 'Chinhoyi Rural',
            'county_name': 'Mashonaland West',
            'crops': ['Tomatoes', 'Maize', 'Groundnuts'],
            'business_phone': '+263 75 678 9012',
            'business_email': 'grace@familyfarm.co.zw',
            'farm_size': '4 hectares',
            'coordinates': Point(30.2000, -17.3667),  # Chinhoyi coordinates
            'rating': 4.2,
            'total_reviews': 9,
            'is_verified': False,
        },
        {
            'username': 'thomas_export',
            'email': 'thomas.export@example.com',
            'first_name': 'Thomas',
            'last_name': 'Katsande',
            'business_name': 'Export Quality Farms',
            'location': 'Bindura Agricultural Area',
            'county_name': 'Mashonaland Central',
            'crops': ['Export Tomatoes', 'Baby Corn'],
            'business_phone': '+263 76 789 0123',
            'business_email': 'exports@eqfarms.co.zw',
            'farm_size': '15 hectares',
            'coordinates': Point(31.3333, -17.3000),  # Bindura coordinates
            'rating': 4.8,
            'total_reviews': 42,
            'is_verified': True,
        },
        {
            'username': 'anna_local',
            'email': 'anna.local@example.com',
            'first_name': 'Anna',
            'last_name': 'Dube',
            'business_name': 'Local Harvest Collective',
            'location': 'Hwange Town',
            'county_name': 'Matabeleland North',
            'crops': ['Tomatoes', 'Okra', 'Eggplant'],
            'business_phone': '+263 79 890 1234',
            'business_email': 'anna@localharvest.co.zw',
            'farm_size': '2 hectares',
            'coordinates': Point(26.4833, -18.3667),  # Hwange coordinates
            'rating': 4.3,
            'total_reviews': 12,
            'is_verified': True,
        },
    ]

    created_count = 0
    for farmer_data in farmers_data:
        try:
            # Get or create county
            county, _ = County.objects.get_or_create(
                name=farmer_data['county_name'],
                defaults={'code': farmer_data['county_name'][:2].upper(), 'is_active': True}
            )

            # Create user if doesn't exist
            user, user_created = User.objects.get_or_create(
                username=farmer_data['username'],
                defaults={
                    'email': farmer_data['email'],
                    'first_name': farmer_data['first_name'],
                    'last_name': farmer_data['last_name'],
                }
            )

            if user_created:
                user.set_password('password123')  # Default password for testing
                user.save()

            # Create farmer profile
            farmer_profile, profile_created = FarmerProfile.objects.get_or_create(
                user=user,
                defaults={
                    'business_name': farmer_data['business_name'],
                    'location': farmer_data['location'],
                    'county': county,
                    'crops': farmer_data['crops'],
                    'rating': farmer_data['rating'],
                    'total_reviews': farmer_data['total_reviews'],
                    'is_verified': farmer_data['is_verified'],
                    'coordinates': farmer_data['coordinates'],
                    'farm_size': farmer_data['farm_size'],
                    'business_phone': farmer_data['business_phone'],
                    'business_email': farmer_data['business_email'],
                    'years_experience': 5,
                    'active_listings': 3,
                    'total_sales': 150,
                    'response_rate': 95.0,
                    'avg_response_time': 2,
                }
            )

            if profile_created:
                created_count += 1
                print(f"✅ Created farmer: {farmer_profile.farmer_name} ({farmer_profile.location})")
                print(f"   📞 Phone: {farmer_profile.business_phone}")
                print(f"   📧 Email: {farmer_profile.business_email}")
                print(f"   ⭐ Rating: {farmer_profile.rating}/5.0 ({farmer_profile.total_reviews} reviews)")
                print(f"   🌱 Crops: {', '.join(farmer_profile.crops)}")
                print()
            else:
                print(f"ℹ️  Farmer already exists: {farmer_profile.farmer_name}")

        except Exception as e:
            print(f"❌ Error creating farmer {farmer_data['username']}: {e}")

    print(f"📊 Farmers created: {created_count} new farmers")
    print(f"📍 Total farmers in database: {FarmerProfile.objects.count()}")

def main():
    """Main function to populate sample farmers"""
    print("🌱 Farm-Link AI - Sample Farmers Population Script")
    print("=" * 60)

    try:
        print("\n👨‍🌾 Creating Sample Farmers...")
        create_sample_farmers()

        print("\n✅ Sample farmers population completed successfully!")
        print("\n📋 Farmers can now be viewed in the Map tab with contact details:")
        print("   - Buyers can see all farmers and their contact information")
        print("   - Farmers can see other farmers for networking")
        print("   - Contact details include phone numbers and email addresses")
        print("   - Farmers are shown with ratings, crops, and verification status")

    except Exception as e:
        print(f"\n❌ Error during farmer population: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()