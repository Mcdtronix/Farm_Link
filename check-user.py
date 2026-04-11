#!/usr/bin/env python

import os
import sys
import django

# Add the backend directory to Python path
sys.path.append('/home/aqi/Documents/Projects/Farm-Link-AI/backend')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from django.contrib.auth.models import User

print("🔍 Checking User Accounts")
print("=" * 40)

# Check if user exists
email = 'gudomacdonald16@gmail.com'
try:
    user = User.objects.get(email=email)
    print(f"✅ User found:")
    print(f"   ID: {user.id}")
    print(f"   Username: {user.username}")
    print(f"   Email: {user.email}")
    print(f"   First Name: {user.first_name}")
    print(f"   Last Name: {user.last_name}")
    print(f"   Is Active: {user.is_active}")
    print(f"   Is Staff: {user.is_staff}")
    print(f"   Date Joined: {user.date_joined}")
    
    # Check if user can authenticate
    from django.contrib.auth import authenticate
    test_password = 'gshsgahA42'
    auth_user = authenticate(username=user.username, password=test_password)
    if auth_user:
        print(f"✅ Password authentication: SUCCESS")
    else:
        print(f"❌ Password authentication: FAILED")
        print(f"   Test password: {test_password}")
        
except User.DoesNotExist:
    print(f"❌ User with email '{email}' does not exist")

print("\n📊 All Users:")
print("-" * 40)
for user in User.objects.all():
    print(f"   {user.email} - {user.username} - {user.first_name} {user.last_name}")

print("\n🔧 To create a test user:")
print("python manage.py shell")
print(">>> from django.contrib.auth.models import User")
print(">>> User.objects.create_user('testuser', 'test@example.com', 'Test123!@#', first_name='Test', last_name='User')")
