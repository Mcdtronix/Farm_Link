#!/usr/bin/env python
"""
Database Repair Script for UserProfile-User Relationship
Fixes orphaned profiles and missing profile relationships
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Core.settings')
django.setup()

from django.contrib.auth.models import User
from tomato_grading_api.models import UserProfile

def repair_profile_relationships():
    """Repair broken UserProfile-User relationships."""
    print("🔧 DATABASE REPAIR: UserProfile-User Relationships")
    print("=" * 60)
    
    # Step 1: Find orphaned profiles
    orphaned_profiles = UserProfile.objects.filter(user__isnull=True)
    print(f"🔍 Found {orphaned_profiles.count()} orphaned profiles")
    
    for profile in orphaned_profiles:
        print(f"   Orphaned Profile ID: {profile.id} | Role: {profile.role}")
    
    # Step 2: Find users without profiles
    users_without_profiles = []
    for user in User.objects.all():
        try:
            profile = user.userprofile
        except (UserProfile.DoesNotExist, AttributeError):
            users_without_profiles.append(user)
    
    print(f"\n🔍 Found {len(users_without_profiles)} users without profiles:")
    for user in users_without_profiles:
        print(f"   User: {user.username} | Email: {user.email}")
    
    # Step 3: Attempt to match orphaned profiles with users
    print(f"\n🔧 Attempting to match orphaned profiles...")
    
    for profile in orphaned_profiles:
        # Try to find user by email if profile has email-like identifier
        matched_user = None
        
        # Strategy 1: Try to match by partial email/username
        for user in users_without_profiles:
            if (user.email and profile.phone and user.email in profile.phone) or \
               (user.username.lower() in str(profile.id).lower()):
                matched_user = user
                break
        
        if matched_user:
            print(f"   ✅ Matching Profile {profile.id} with User {matched_user.username}")
            profile.user = matched_user
            profile.save()
            users_without_profiles.remove(matched_user)
        else:
            print(f"   ❌ No match found for Profile {profile.id} - Deleting orphan")
            profile.delete()
    
    # Step 4: Create missing profiles for remaining users
    print(f"\n🔧 Creating profiles for remaining users...")
    
    for user in users_without_profiles:
        # Default to 'farmer' role for consistency
        profile = UserProfile.objects.create(
            user=user,
            role='farmer',
            phone='',
            county='',
            location=''
        )
        print(f"   ✅ Created profile for {user.username} with role: {profile.role}")
    
    # Step 5: Verify fix
    print(f"\n✅ VERIFICATION:")
    users_with_profile = 0
    users_without_profile = 0
    
    for user in User.objects.all():
        try:
            profile = user.userprofile
            users_with_profile += 1
            print(f"   ✅ {user.username} -> {profile.role}")
        except (UserProfile.DoesNotExist, AttributeError):
            users_without_profile += 1
            print(f"   ❌ {user.username} -> NO PROFILE")
    
    print(f"\n📊 FINAL RESULTS:")
    print(f"   Users with profiles: {users_with_profile}")
    print(f"   Users without profiles: {users_without_profile}")
    
    if users_without_profile == 0:
        print(f"   🎉 ALL USERS HAVE PROFILES! Database repaired successfully!")
    else:
        print(f"   ⚠️  Some users still missing profiles - manual intervention required")

if __name__ == "__main__":
    repair_profile_relationships()
