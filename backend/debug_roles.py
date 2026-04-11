#!/usr/bin/env python
"""
Django Role Assignment Diagnostic Script
Run: python manage.py shell < debug_roles.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from django.contrib.auth.models import User
from tomato_grading_api.models import UserProfile

def diagnose_role_assignment():
    """Diagnose role assignment issues."""
    print("🔍 ROLE ASSIGNMENT DIAGNOSTIC REPORT")
    print("=" * 50)
    
    # Check all users
    users = User.objects.all()
    print(f"Total users in database: {users.count()}")
    print()
    
    # Check user-profile relationships
    users_with_profile = 0
    users_without_profile = 0
    
    for user in users:
        try:
            profile = user.userprofile
            users_with_profile += 1
            print(f"✅ User: {user.username} | Email: {user.email}")
            print(f"   Profile Role: {profile.role}")
            print(f"   Profile ID: {profile.id}")
            print(f"   Created: {profile.created_at}")
            print()
        except UserProfile.DoesNotExist:
            users_without_profile += 1
            print(f"❌ User: {user.username} | Email: {user.email}")
            print(f"   NO PROFILE FOUND!")
            print()
        except AttributeError:
            users_without_profile += 1
            print(f"❌ User: {user.username} | Email: {user.email}")
            print(f"   PROFILE RELATIONSHIP MISSING!")
            print()
    
    print("=" * 50)
    print(f"Users with profiles: {users_with_profile}")
    print(f"Users without profiles: {users_without_profile}")
    print()
    
    # Check profile data integrity
    profiles = UserProfile.objects.all()
    print(f"Total profiles in database: {profiles.count()}")
    print()
    
    role_counts = {}
    for profile in profiles:
        role = profile.role
        role_counts[role] = role_counts.get(role, 0) + 1
    
    print("Role distribution:")
    for role, count in role_counts.items():
        print(f"  {role}: {count}")
    print()
    
    # Test specific user if provided
    if len(sys.argv) > 1:
        email = sys.argv[1]
        try:
            user = User.objects.get(email=email)
            print(f"🎯 Testing specific user: {email}")
            print(f"User ID: {user.id}")
            print(f"Username: {user.username}")
            
            try:
                profile = user.userprofile
                print(f"Profile Role: {profile.role}")
                print(f"Profile County: {profile.county}")
                print(f"Profile Location: {profile.location}")
                print(f"Profile Phone: {profile.phone}")
                
                # Simulate login response
                login_response = {
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                    "profile": {
                        "role": profile.role,
                        "county": profile.county,
                        "location": profile.location,
                        "phone": profile.phone,
                    }
                }
                
                print(f"\n📤 Login Response Profile Data:")
                print(f"   role: {login_response['profile']['role']}")
                print(f"   county: {login_response['profile']['county']}")
                print(f"   location: {login_response['profile']['location']}")
                
            except UserProfile.DoesNotExist:
                print("❌ NO PROFILE - Would default to 'buyer' role!")
                
        except User.DoesNotExist:
            print(f"❌ User with email {email} not found")

if __name__ == "__main__":
    diagnose_role_assignment()
