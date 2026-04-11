# 🔍 Connection Issue Diagnostic Checklist

## Step 1: Verify Backend is Running

**Check if Django server is running:**
```bash
# Check if port 8000 is listening
netstat -tlnp | grep :8000
# OR
lsof -i :8000
```

**Expected output:**
```
tcp  0  0 127.0.0.1:8000  0.0.0.0:*  LISTEN  12345/python
```

**If not running, start it:**
```bash
cd /home/aqi/Documents/Projects/Farm-Link-AI/backend
python manage.py runserver 8000
```

## Step 2: Test Backend Health

**Test the health endpoint:**
```bash
curl -v http://localhost:8000/api/v1/health/
```

**Expected response:**
```
* About to connect() to localhost port 8000 (#0)
*   Trying 127.0.0.1...
* Connected to localhost (127.0.0.1) port 8000 (#0)
> GET /api/v1/health/ HTTP/1.1
> User-Agent: curl/7.68.0
> Host: localhost:8000
> Accept: */*
>
< HTTP/1.1 200 OK
< Date: ...
< Content-Type: application/json
< X-Frame-Options: DENY
< Content-Length: ...
< Vary: Accept, Cookie
< Allow: GET, HEAD, OPTIONS
< X-Content-Type-Options: nosniff
< Referrer-Policy: same-origin
< Cross-Origin-Opener-Policy: same-origin
<
{"status": "healthy", "timestamp": "...", "version": "2.0.0"}
```

## Step 3: Check CORS Headers

**Test CORS with frontend origin:**
```bash
curl -v -H "Origin: http://localhost:8081" http://localhost:8000/api/v1/health/
```

**Look for these headers in response:**
```
< Access-Control-Allow-Origin: http://localhost:8081
< Access-Control-Allow-Credentials: true
```

## Step 4: Verify Frontend Configuration

**Check AuthContext API URL:**
```bash
grep -n "API_BASE_URL" /home/aqi/Documents/Projects/Farm-Link-AI/contexts/AuthContext.tsx
```

**Should show:**
```
const API_BASE_URL = "http://localhost:8000/api/v1";
```

**Check environment variable:**
```bash
# In frontend directory
echo $EXPO_PUBLIC_DOMAIN
```

**Should be:**
```
localhost:8000
```

## Step 5: Test Registration Endpoint Directly

**Test registration with curl:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8081" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!@#",
    "password2": "Test123!@#",
    "first_name": "Test",
    "last_name": "User",
    "phone": "0712345678",
    "role": "farmer",
    "county": "Harare",
    "location": "Test Location"
  }'
```

**Expected success response:**
```
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {...},
  "email_verification_required": true
}
```

## Step 6: Check Django Logs

**Start Django with verbose logging:**
```bash
cd backend
python manage.py runserver 8000 --verbosity=2
```

**Look for:**
- CORS middleware loading
- Request processing logs
- Any error messages

## Step 7: Check Database

**Verify database is accessible:**
```bash
cd backend
python manage.py dbshell
```

**Check if tables exist:**
```sql
.tables
```

**Should include:**
- auth_user
- tomato_grading_emailverification
- tomato_grading_twofactorauth
- tomato_grading_loginattempt

## Step 8: Test Frontend Network Request

**Open browser dev tools and:**
1. Go to frontend app
2. Try to register
3. Check Network tab
4. Look for the registration request
5. Check request URL: should be `http://localhost:8000/api/v1/auth/register/`
6. Check response headers and status

## Common Error Messages & Solutions

### "Network request failed"
**Cause**: Backend not running or wrong URL
**Solution**: Start Django server and verify URL

### "CORS policy: No 'Access-Control-Allow-Origin' header"
**Cause**: CORS not configured properly
**Solution**: Check Django CORS settings

### "Connection refused"
**Cause**: Port blocked or server not listening
**Solution**: Check if Django is running on port 8000

### "Timeout"
**Cause**: Server too slow or network issues
**Solution**: Check server performance and try again

## Quick Fix Commands

```bash
# Kill all processes on ports 8000 and 8081
sudo fuser -k 8000/tcp 8081/tcp

# Start fresh backend
cd backend && python manage.py runserver 8000

# Start fresh frontend  
npx expo start --port 8081

# Test connection
curl http://localhost:8000/api/v1/health/
```

## Environment Setup

**Create .env.local in frontend root:**
```
EXPO_PUBLIC_DOMAIN=localhost:8000
```

**Verify Django CORS settings in settings.py:**
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081"
]
CORS_ALLOW_ALL_ORIGINS = True  # Development only
```

## If All Else Fails

1. **Restart everything**:
   ```bash
   # Kill all processes
   pkill -f "python manage.py runserver"
   pkill -f "expo start"
   
   # Start fresh
   cd backend && python manage.py runserver 8000 &
   npx expo start --port 8081 &
   ```

2. **Check Django admin**: `http://localhost:8000/admin/`
   - Login with admin/admin123
   - Check if authentication models exist

3. **Run migrations**: `python manage.py migrate`

4. **Check imports**: Ensure no circular imports in views.py

5. **Test with Postman**: Import the API endpoints and test manually
