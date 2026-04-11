#!/usr/bin/env python
"""
Test script to verify Django server can start without errors
"""

import os
import sys
import django
import subprocess

def test_django_check():
    """Test Django system check"""
    print("🔍 Running Django system check...")
    
    try:
        # Setup Django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
        django.setup()
        
        # Run system check
        from django.core.management import execute_from_command_line
        execute_from_command_line(['manage.py', 'check'])
        
        print("✅ Django system check passed!")
        return True
        
    except Exception as e:
        print(f"❌ Django system check failed: {e}")
        return False

def test_imports():
    """Test critical imports"""
    print("\n🔍 Testing critical imports...")
    
    try:
        # Test model imports
        from tomato_grading_api.models import County, ProductCategory, FarmerProfile
        print("✅ Models imported successfully")
        
        # Test serializer imports
        from tomato_grading_api.serializers import (
            CountySerializer, 
            ProductCategorySerializer, 
            FarmerProfileSerializer,
            FarmerProfileListSerializer
        )
        print("✅ Serializers imported successfully")
        
        # Test view imports
        from tomato_grading_api.views import (
            CountyListView,
            ProductCategoryListView, 
            FarmerDirectoryView,
            FarmerDetailView,
            MyFarmerProfileView,
            MarketPriceListView
        )
        print("✅ Views imported successfully")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_url_resolution():
    """Test URL resolution"""
    print("\n🔍 Testing URL resolution...")
    
    try:
        from django.urls import reverse
        from django.test import Client
        
        # Test URL reversal
        county_url = reverse('v1:county-list')
        print(f"✅ County URL resolved: {county_url}")
        
        category_url = reverse('v1:category-list')
        print(f"✅ Category URL resolved: {category_url}")
        
        farmer_url = reverse('v1:farmer-directory')
        print(f"✅ Farmer directory URL resolved: {farmer_url}")
        
        return True
        
    except Exception as e:
        print(f"❌ URL resolution error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Farm-Link AI - Server Start Test")
    print("=" * 50)
    
    tests = [
        ("Django Check", test_django_check),
        ("Import Test", test_imports),
        ("URL Resolution", test_url_resolution),
    ]
    
    results = {
        'total': len(tests),
        'passed': 0,
        'failed': 0
    }
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        try:
            if test_func():
                results['passed'] += 1
                print(f"✅ {test_name} PASSED")
            else:
                results['failed'] += 1
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            results['failed'] += 1
            print(f"❌ {test_name} ERROR: {e}")
    
    # Summary
    print(f"\n{'='*50}")
    print("📊 TEST SUMMARY")
    print(f"{'='*50}")
    print(f"📈 Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📊 Success Rate: {(results['passed']/results['total']*100):.1f}%")
    
    if results['failed'] == 0:
        print("\n🎉 ALL TESTS PASSED! Server should start successfully.")
        print("\n🚀 You can now run: python manage.py runserver")
    else:
        print(f"\n⚠️  {results['failed']} tests failed. Please fix issues before starting server.")
    
    return results['failed'] == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
