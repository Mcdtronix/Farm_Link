# Backend-Frontend Connection Debugging Guide

## 🔧 **Current Configuration**

### Backend (Django)
- **URL**: `http://localhost:8000` or `http://127.0.0.1:8000`
- **API Endpoints**: `/api/v1/`
- **CORS**: Configured for `localhost:8081` and `127.0.0.1:8081`
- **Health Check**: `/api/v1/health/`

### Frontend (Expo/React Native)
- **URL**: `http://localhost:8081` or `http://127.0.0.1:8081`
- **API Base URL**: `http://localhost:8000`
- **Environment Variable**: `EXPO_PUBLIC_DOMAIN=localhost:8000`

## 🐛 **Common Issues & Solutions**

### 1. "Network Request Failed" Error

**Possible Causes:**
- Django backend not running
- Wrong port configuration
- CORS issues
- Firewall blocking connection

**Solutions:**

#### Step 1: Start Django Backend
```bash
cd /home/aqi/Documents/Projects/Farm-Link-AI/backend
python manage.py runserver 8000
```

#### Step 2: Test Backend Connection
```bash
# Test health endpoint
curl http://localhost:8000/api/v1/health/

# Or run the test script
node test-backend-connection.js
```

#### Step 3: Check CORS Configuration
The backend should respond with these headers:
```
Access-Control-Allow-Origin: http://localhost:8081
Access-Control-Allow-Credentials: true
```

### 2. CORS Issues

**Symptoms:**
- Browser blocks requests
- CORS policy errors in console
- Preflight requests failing

**Solution:**
Backend CORS is configured in `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
CORS_ALLOW_ALL_ORIGINS = True  # Development only
```

### 3. Port Conflicts

**Check if ports are in use:**
```bash
# Check port 8000 (backend)
lsof -i :8000

# Check port 8081 (frontend)
lsof -i :8081
```

**Kill processes if needed:**
```bash
# Kill process on port 8000
kill -9 $(lsof -t -i:8000)

# Kill process on port 8081
kill -9 $(lsof -t -i:8081)
```

## 🚀 **Startup Sequence**

### 1. Start Backend (Django)
```bash
cd backend
python manage.py runserver 8000
```
Expected output:
```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
Django version 5.2.12, using settings 'Core.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### 2. Start Frontend (Expo)
```bash
npx expo start --port 8081
```
Expected output:
```
Metro waiting on exp://127.0.0.1:8081
Scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

### 3. Test Connection
Open in browser: `http://localhost:8000/api/v1/health/`

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "2.0.0",
  "services": {
    "database": "connected",
    "ml_models": "loaded"
  }
}
```

## 🔍 **Debugging Steps**

### Step 1: Verify Backend is Running
```bash
curl -I http://localhost:8000/api/v1/health/
```
Look for `HTTP/1.1 200 OK` and CORS headers.

### Step 2: Verify Frontend Configuration
Check that `EXPO_PUBLIC_DOMAIN` is set:
```bash
# In frontend directory
echo $EXPO_PUBLIC_DOMAIN
```

### Step 3: Test API Endpoints Directly
```bash
# Test registration endpoint
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!","password2":"Test123!","first_name":"Test","last_name":"User","phone":"0712345678","role":"farmer","county":"Harare","location":"Test"}'
```

### Step 4: Check Network Logs
In browser dev tools or React Native debugger:
1. Open Network tab
2. Attempt login/registration
3. Check request URL, headers, and response
4. Look for CORS errors or connection refused

## 🛠️ **Configuration Files**

### Backend: `backend/Core/settings.py`
```python
# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081"
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True  # Development only
```

### Frontend: `.env.local` (create this file)
```
EXPO_PUBLIC_DOMAIN=localhost:8000
```

### Frontend: `contexts/AuthContext.tsx`
```typescript
const API_BASE_URL = "http://localhost:8000/api/v1";
```

## 📱 **Testing on Mobile Devices**

### Android
1. Ensure phone and computer are on same WiFi network
2. Use computer's IP address instead of localhost
3. Update `EXPO_PUBLIC_DOMAIN=192.168.1.100:8000`

### iOS
1. Same network requirement as Android
2. Use IP address in configuration
3. Check iOS network settings

## 🚨 **Error Messages & Solutions**

### "Network request failed"
- **Cause**: Backend not running or wrong URL
- **Solution**: Start Django server and check URL

### "CORS policy error"
- **Cause**: Frontend origin not allowed
- **Solution**: Update CORS settings in Django

### "Connection refused"
- **Cause**: Port blocked or server not listening
- **Solution**: Check port usage and firewall

### "Timeout"
- **Cause**: Server too slow or network issues
- **Solution**: Check server performance and network

## 🔄 **Development Workflow**

1. **Start Backend**: `cd backend && python manage.py runserver 8000`
2. **Test Backend**: Open `http://localhost:8000/api/v1/health/`
3. **Start Frontend**: `npx expo start --port 8081`
4. **Test Connection**: Try registration in the app
5. **Check Logs**: Monitor both backend and frontend logs

## 📞 **Getting Help**

If issues persist:
1. Check Django admin: `http://localhost:8000/admin/`
2. Verify database migrations: `python manage.py migrate`
3. Check Django logs for errors
4. Test with Postman or curl directly
5. Restart both servers and try again
