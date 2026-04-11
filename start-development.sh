#!/bin/bash

echo "🚀 Starting AgriLink Development Environment"
echo "=========================================="

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        echo "   Killing process on port $port..."
        kill -9 $(lsof -t -i:$port) 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for server to start
wait_for_server() {
    local url=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for server to start at $url"
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo "✅ Server is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ Server failed to start within expected time"
    return 1
}

# Check and clear ports
echo "🔧 Checking ports..."
check_port 8000
check_port 8081

# Navigate to backend directory
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f ".deps_installed" ]; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
    touch .deps_installed
fi

# Run database migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Create superuser if needed
echo "👤 Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Created superuser: admin/admin123')
else:
    print('Superuser already exists')
"

# Start Django backend
echo "🎯 Starting Django backend on port 8000..."
python manage.py runserver 8000 &
BACKEND_PID=$!

# Wait for backend to start
if wait_for_server "http://localhost:8000/api/v1/health/"; then
    echo "✅ Backend started successfully!"
    echo "🌐 Backend URL: http://localhost:8000"
    echo "📊 Admin Panel: http://localhost:8000/admin/"
    echo "📚 API Docs: http://localhost:8000/api/docs/"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Navigate to root directory for frontend
cd ..

# Start frontend
echo "📱 Starting Expo frontend on port 8081..."
npx expo start --port 8081 &
FRONTEND_PID=$!

echo ""
echo "🎉 Development environment is ready!"
echo "=================================="
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:8081"
echo "Admin:    http://localhost:8000/admin/ (admin/admin123)"
echo ""
echo "📝 To test the connection:"
echo "   1. Open the app on http://localhost:8081"
echo "   2. Try registering a new account"
echo "   3. Check browser console for any errors"
echo ""
echo "🛑 To stop all servers:"
echo "   Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"

# Wait for user interrupt
trap 'echo ""; echo "🛑 Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT

# Keep script running
wait
