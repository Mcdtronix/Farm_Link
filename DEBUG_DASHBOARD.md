# 🔍 Debugging Dashboard - Frontend-Backend Communication

This guide helps you monitor and debug the communication between frontend and backend.

## 🚀 **How to Use**

1. **Start both servers** with debugging enabled
2. **Open browser console** (F12) for frontend logs
3. **Monitor terminal** for backend logs
4. **Follow the flow** of requests and responses

## 📊 **What You'll See**

### **Frontend Console Logs**
```
🌐 FRONTEND API REQUEST:
   URL: http://localhost:8000/api/v1/auth/register/
   Method: POST
   Headers: {
     "Content-Type": "application/json",
     "Authorization": "Bearer [token]"
   }
   Body: {"username":"test","email":"test@example.com",...}
   Token present: false

📤 FRONTEND API RESPONSE:
   Status: 201
   Status Text: Created
   Headers: {
     "Content-Type": "application/json",
     "Access-Control-Allow-Origin": "http://localhost:8081"
   }
   Response Data: {
     "message": "Account created successfully",
     "user": {...},
     "email_verification_required": true
   }

✅ API REQUEST SUCCESSFUL
```

### **Backend Terminal Logs**
```
[2024-03-14 12:00:00] INFO [tomato_grading_api] 🔥 INCOMING REQUEST:
   Method: POST
   URL: /api/v1/auth/register/
   Headers: {
     "Content-Type": "application/json",
     "User-Agent": "Mozilla/5.0..."
   }
   Body: {"username":"test","email":"test@example.com",...}
   IP Address: 127.0.0.1

[2024-03-14 12:00:00] INFO [tomato_grading_api] 🔐 REGISTRATION REQUEST RECEIVED
   Request data: {"username":"test","email":"test@example.com",...}
   Client IP: 127.0.0.1
   User-Agent: Mozilla/5.0...

[2024-03-14 12:00:01] INFO [tomato_grading_api] ✅ USER CREATED SUCCESSFULLY
   User ID: 123
   Username: test
   Email: test@example.com

[2024-03-14 12:00:01] INFO [tomato_grading_api] 📧 SENDING VERIFICATION EMAIL
   Verification URL: http://localhost:8081/verify-email/[token]/

[2024-03-14 12:00:02] INFO [tomato_grading_api] ✅ VERIFICATION EMAIL SENT SUCCESSFULLY

[2024-03-14 12:00:02] INFO [tomato_grading_api] 📤 OUTGOING RESPONSE:
   Status Code: 201
   Duration: 1.234s
   Headers: {
     "Content-Type": "application/json",
     "Access-Control-Allow-Origin": "http://localhost:8081",
     "Access-Control-Allow-Credentials": "true"
   }
   Content: {"message": "Account created successfully",...}
```

## 🔧 **Debugging Checklist**

### **1. Frontend Debugging**
- [ ] Open browser dev tools (F12)
- [ ] Go to Console tab
- [ ] Look for 🌐 FRONTEND API REQUEST logs
- [ ] Check URL is correct: `http://localhost:8000/api/v1/...`
- [ ] Verify request headers and body
- [ ] Check response status and data

### **2. Backend Debugging**
- [ ] Start Django with: `python manage.py runserver 8000`
- [ ] Watch terminal for 🔥 INCOMING REQUEST logs
- [ ] Verify request data is received correctly
- [ ] Check for any validation errors
- [ ] Confirm 📤 OUTGOING RESPONSE includes CORS headers

### **3. Network Issues**
- [ ] Check if backend is running: `curl http://localhost:8000/api/v1/health/`
- [ ] Verify CORS headers in response
- [ ] Check for "Network request failed" in frontend
- [ ] Look for CORS errors in browser console

## 🚨 **Common Issues & Solutions**

### **"Network request failed"**
**Frontend Console:**
```
❌ API REQUEST FAILED: Network request failed
```

**Solution:**
1. Check if Django is running on port 8000
2. Verify URL in AuthContext: `const API_BASE_URL = "http://localhost:8000/api/v1"`
3. Check network tab for actual HTTP error

### **CORS Issues**
**Backend Console:**
```
🌐 CORS PREFLIGHT REQUEST DETECTED
   Origin: http://localhost:8081
```

**Frontend Console:**
```
Access to fetch at 'http://localhost:8000/api/v1/auth/register/' from origin 'http://localhost:8081' has been blocked by CORS policy
```

**Solution:**
1. Verify CORS settings in Django settings.py
2. Check that `CORS_ALLOWED_ORIGINS` includes `http://localhost:8081`
3. Ensure `CORS_ALLOW_ALL_ORIGINS = True` for development

### **Validation Errors**
**Backend Console:**
```
❌ REGISTRATION VALIDATION FAILED
   Errors: {"email": ["Enter a valid email address"]}
```

**Frontend Console:**
```
❌ REGISTRATION FAILED: Please correct the errors below.
```

**Solution:**
1. Check form validation in frontend
2. Verify Zimbabwean phone format: `+263712345678` or `0712345678`
3. Ensure password meets complexity requirements

### **Email Issues**
**Backend Console:**
```
❌ FAILED TO SEND VERIFICATION EMAIL: [Errno 61] Connection refused
```

**Solution:**
1. Check email configuration in settings.py
2. Verify SMTP credentials are correct
3. Ensure firewall allows SMTP connections

## 📱 **Testing Flow**

### **Registration Test**
1. **Frontend**: Fill registration form
2. **Frontend Console**: 🌐 API REQUEST with user data
3. **Backend Console**: 🔐 REGISTRATION REQUEST RECEIVED
4. **Backend Console**: ✅ USER CREATED SUCCESSFULLY
5. **Backend Console**: 📧 SENDING VERIFICATION EMAIL
6. **Frontend Console**: 📤 RESPONSE with email_verification_required
7. **Frontend**: Show "check your email" message

### **Login Test**
1. **Frontend**: Enter credentials
2. **Frontend Console**: 🔐 LOGIN ATTEMPT
3. **Backend Console**: 🔐 LOGIN REQUEST RECEIVED
4. **Backend Console**: ✅ AUTHENTICATION SUCCESSFUL
5. **Frontend Console**: 🎉 LOGIN SUCCESSFUL
6. **Frontend Console**: ✅ USER SESSION STORED
7. **Frontend**: Redirect to dashboard

## 🛠️ **Advanced Debugging**

### **Enable Django Debug Toolbar**
```python
# settings.py
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
INTERNAL_IPS = ['127.0.0.1']
```

### **Log All Database Queries**
```python
# settings.py
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'DEBUG',
    'propagate': False,
}
```

### **Monitor Network Requests**
```bash
# Monitor all HTTP requests
sudo tcpdump -i lo port 8000

# Or use Wireshark for GUI monitoring
```

### **Check Database State**
```bash
# Django shell
python manage.py shell

# Check users
from django.contrib.auth.models import User
users = User.objects.all()
for user in users:
    print(f"{user.email} - verified: {user.email_verification.is_verified}")
```

## 📈 **Performance Monitoring**

### **Request Timing**
Backend logs show request duration:
```
Duration: 1.234s
```

### **Database Query Count**
Add to views:
```python
from django.db import connection
logger.info(f"Database queries: {len(connection.queries)}")
```

### **Memory Usage**
```python
import psutil
logger.info(f"Memory usage: {psutil.Process().memory_info().rss / 1024 / 1024:.1f} MB")
```

## 🎯 **Success Indicators**

### **Successful Registration**
- ✅ Frontend shows "Account created successfully"
- ✅ Backend shows "USER CREATED SUCCESSFULLY"
- ✅ Email sent confirmation in backend
- ✅ User can verify email via link

### **Successful Login**
- ✅ Frontend shows "Login successful"
- ✅ Backend shows "AUTHENTICATION SUCCESSFUL"
- ✅ JWT tokens generated and stored
- ✅ User redirected to dashboard

### **CORS Working**
- ✅ No CORS errors in browser console
- ✅ CORS headers present in backend response
- ✅ Requests complete successfully

## 🔧 **Quick Debug Commands**

```bash
# Test backend health
curl -v http://localhost:8000/api/v1/health/

# Test registration endpoint
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!@#","password2":"Test123!@#","first_name":"Test","last_name":"User","phone":"0712345678","role":"farmer","county":"Harare","location":"Test"}'

# Check Django logs in real-time
tail -f /path/to/django.log

# Monitor network traffic
netstat -an | grep :8000
```

With this debugging setup, you'll have complete visibility into the frontend-backend communication and can quickly identify and resolve any issues!
