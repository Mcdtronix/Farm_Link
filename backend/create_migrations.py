#!/usr/bin/env python
"""
Create migrations for new models
"""

import os
import sys
import subprocess

def create_migrations():
    """Create Django migrations for new models"""
    print("🔄 Creating Django migrations...")
    
    try:
        # Create migrations
        result = subprocess.run(
            ['python', 'manage.py', 'makemigrations'],
            capture_output=True,
            text=True,
            cwd='/home/aqi/Documents/Projects/Farm-Link-AI/backend'
        )
        
        if result.returncode == 0:
            print("✅ Migrations created successfully!")
            print(result.stdout)
        else:
            print("❌ Error creating migrations:")
            print(result.stderr)
            return False
            
        # Apply migrations
        print("\n🔄 Applying migrations...")
        result = subprocess.run(
            ['python', 'manage.py', 'migrate'],
            capture_output=True,
            text=True,
            cwd='/home/aqi/Documents/Projects/Farm-Link-AI/backend'
        )
        
        if result.returncode == 0:
            print("✅ Migrations applied successfully!")
            print(result.stdout)
        else:
            print("❌ Error applying migrations:")
            print(result.stderr)
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Error during migration process: {e}")
        return False

if __name__ == "__main__":
    success = create_migrations()
    if success:
        print("\n🎉 Migration process completed successfully!")
    else:
        print("\n💥 Migration process failed!")
        sys.exit(1)
