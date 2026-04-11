#!/usr/bin/env python
"""
Test script for new API endpoints
"""

import os
import sys
import json
import requests
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"

def test_endpoint(endpoint, method="GET", data=None, description=""):
    """Test a single API endpoint"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing: {description}")
    print(f"📍 Endpoint: {method} {endpoint}")
    print(f"{'='*60}")
    
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}")
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{endpoint}", json=data)
        elif method == "PATCH":
            response = requests.patch(f"{BASE_URL}{endpoint}", json=data)
        else:
            print(f"❌ Unsupported method: {method}")
            return False
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS")
            try:
                data = response.json()
                print(f"📄 Response Data:")
                if isinstance(data, list):
                    print(f"   - Count: {len(data)} items")
                    if data:
                        print(f"   - First item: {json.dumps(data[0], indent=2)[:200]}...")
                elif isinstance(data, dict):
                    print(f"   - Keys: {list(data.keys())}")
                    if 'results' in data:
                        print(f"   - Results count: {len(data['results'])}")
                else:
                    print(f"   - Data: {str(data)[:200]}...")
            except:
                print(f"   - Raw response: {response.text[:200]}...")
        else:
            print("❌ FAILED")
            try:
                error_data = response.json()
                print(f"   - Error: {error_data}")
            except:
                print(f"   - Error: {response.text}")
        
        return response.status_code == 200
        
    except requests.exceptions.ConnectionError:
        print("❌ CONNECTION ERROR - Make sure the Django server is running")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def run_all_tests():
    """Run all endpoint tests"""
    print("🚀 Farm-Link AI - API Endpoint Testing")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Base URL: {BASE_URL}")
    
    tests = [
        # County endpoints
        ("counties/", "GET", None, "List all counties"),
        
        # Category endpoints  
        ("categories/", "GET", None, "List all product categories"),
        
        # Market price endpoints
        ("market-prices/", "GET", None, "List all market prices"),
        ("market-prices/?crop=Tomatoes", "GET", None, "Filter market prices by crop"),
        ("market-prices/?market=Harare", "GET", None, "Filter market prices by market"),
        
        # Farmer directory endpoints
        ("farmers/", "GET", None, "List all farmers"),
        ("farmers/?verified=true", "GET", None, "List verified farmers only"),
        ("farmers/?search=tomato", "GET", None, "Search farmers by name"),
        ("farmers/?crops=Tomatoes", "GET", None, "Filter farmers by crops"),
    ]
    
    results = {
        'total': len(tests),
        'passed': 0,
        'failed': 0
    }
    
    for endpoint, method, data, description in tests:
        success = test_endpoint(endpoint, method, data, description)
        if success:
            results['passed'] += 1
        else:
            results['failed'] += 1
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    print(f"📈 Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📊 Success Rate: {(results['passed']/results['total']*100):.1f}%")
    
    if results['failed'] == 0:
        print("\n🎉 ALL TESTS PASSED! The new endpoints are working correctly.")
    else:
        print(f"\n⚠️  {results['failed']} tests failed. Please check the implementation.")
    
    return results['failed'] == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
