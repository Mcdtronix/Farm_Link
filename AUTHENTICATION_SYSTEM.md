# AgriLink Authentication System

## Overview

AgriLink implements a comprehensive, enterprise-grade authentication system with the following features:

- **Email-based Registration** with verification
- **Two-Factor Authentication (2FA)** using email codes
- **JWT Token Management** with refresh tokens
- **Rate Limiting & Security** with login attempt tracking
- **Backend-Frontend Integration** with fallback to local storage
- **Comprehensive Validation** for all user inputs

## Backend Implementation

### Django Settings Configuration

```python
# Email Configuration
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='gudomacdonald16@gmail.com')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='cbld psyv olpd kbei')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='gudomacdonald16@gmail.com')
FRONTEND_BASE_URL = config('FRONTEND_BASE_URL', default='http://localhost:8081')

# Two-Factor Authentication
TWO_FACTOR_ENABLED = config('TWO_FACTOR_ENABLED', default=True, cast=bool)
TWO_FACTOR_TOKEN_EXPIRE_MINUTES = config('TWO_FACTOR_TOKEN_EXPIRE_MINUTES', default=10, cast=int)
TWO_FACTOR_MAX_ATTEMPTS = config('TWO_FACTOR_MAX_ATTEMPTS', default=3, cast=int)
```

### Database Models

#### EmailVerification Model
- Stores email verification tokens
- 24-hour expiration
- One-time use tokens

#### TwoFactorAuth Model
- Manages 2FA settings and tokens
- 10-minute token expiration
- Backup codes support
- Rate limiting with account lockout

#### LoginAttempt Model
- Tracks all login attempts for security monitoring
- Records IP addresses, user agents, and failure reasons
- Enables security analytics

### API Endpoints

#### Authentication Endpoints
```
POST /api/v1/auth/register/           # User registration
POST /api/v1/auth/login/              # User login
POST /api/v1/auth/2fa/               # 2FA verification
GET  /api/v1/auth/verify-email/<uuid>/ # Email verification
POST /api/v1/auth/setup-2fa/          # Enable 2FA
POST /api/v1/auth/verify-2fa-setup/   # Verify 2FA setup
POST /api/v1/auth/refresh/            # Refresh JWT token
POST /api/v1/auth/logout/             # Logout with token blacklisting
GET  /api/v1/auth/me/                 # Get user profile
```

#### Security Features
- **Rate Limiting**: Scoped throttling for auth endpoints
- **Input Validation**: Comprehensive validation with detailed error messages
- **Password Strength**: Enforces complex passwords with Django validators
- **Email Verification**: Required before account activation
- **2FA Protection**: Optional but recommended security layer
- **Login Tracking**: Monitors failed attempts and suspicious activity

## Frontend Implementation

### React Native Context (AuthContext)

#### Enhanced Features
- **Backend Integration**: Primary authentication via Django API
- **Local Fallback**: Demo mode with AsyncStorage
- **Token Management**: Secure storage of JWT tokens
- **2FA Support**: Complete two-factor authentication flow
- **Error Handling**: Comprehensive error states and user feedback

#### Key Functions
```typescript
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  verifyTwoFactor: (data: TwoFactorData) => Promise<void>;
  setupTwoFactor: (method: string) => Promise<void>;
  verifyTwoFactorSetup: (token: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}
```

### Authentication Screens

#### Login Screen Features
- **Email/Password Validation**: Real-time validation feedback
- **2FA Integration**: Seamless 2FA code entry
- **Backup Code Support**: Fallback authentication method
- **Error Handling**: Clear error messages and recovery options
- **Email Verification**: Prompts users to verify unverified emails

#### Registration Screen Features
- **Comprehensive Validation**: All fields validated with specific rules
- **Password Strength**: Enforces strong password requirements
- **Phone Number Format**: Kenyan phone number validation
- **Role Selection**: Farmer/Buyer role assignment
- **Location Data**: County and location collection

## Security Features

### Password Requirements
- Minimum 8 characters
- Uppercase and lowercase letters
- At least one number
- At least one special character
- No common passwords

### Two-Factor Authentication
- **Email-based Codes**: 6-digit codes sent via email
- **Backup Codes**: 10 one-time backup codes
- **Token Expiration**: 10-minute validity
- **Rate Limiting**: Maximum 3 failed attempts
- **Account Lockout**: 15-minute temporary lock after failures

### Login Security
- **Attempt Tracking**: All login attempts logged
- **IP Recording**: Tracks source IP addresses
- **User Agent Logging**: Records browser/client info
- **Token Blacklisting**: Invalidates tokens on logout
- **Session Management**: Secure JWT token handling

## API Response Formats

### Registration Response
```json
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "username": "username",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "email_verification_required": true,
  "verification_token": "uuid"
}
```

### Login Response
```json
{
  "message": "Login successful.",
  "user": {
    "id": "uuid",
    "username": "username",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "tokens": {
    "access": "jwt_access_token",
    "refresh": "jwt_refresh_token"
  },
  "requires_2fa": false
}
```

### 2FA Required Response
```json
{
  "message": "Please enter 2FA code sent to your email.",
  "requires_2fa": true,
  "user_id": "uuid"
}
```

## Error Handling

### Validation Errors
```json
{
  "error": "validation_error",
  "message": "Please correct errors below.",
  "details": {
    "email": ["Enter a valid email address."],
    "password": ["Password must be at least 8 characters."]
  }
}
```

### Authentication Errors
```json
{
  "error": "invalid_credentials",
  "message": "Invalid email or password."
}
```

### 2FA Errors
```json
{
  "error": "invalid_2fa",
  "message": "Invalid 2FA code or backup code.",
  "remaining_attempts": 2,
  "account_locked": false
}
```

## Integration Guide

### Backend Setup
1. Configure email settings in `settings.py`
2. Run database migrations
3. Set up CORS for frontend domain
4. Configure JWT settings
5. Enable rate limiting

### Frontend Setup
1. Update API base URL in AuthContext
2. Configure AsyncStorage for secure token storage
3. Implement proper error handling
4. Add loading states and user feedback
5. Test 2FA flow end-to-end

### Testing
- **Unit Tests**: Test all validation logic
- **Integration Tests**: Test API endpoints
- **Security Tests**: Test authentication flows
- **UI Tests**: Test user interface flows

## Best Practices

### Security
- Always use HTTPS in production
- Implement proper password policies
- Enable 2FA for all users
- Monitor login attempts
- Regular security audits

### User Experience
- Clear error messages
- Progressive validation
- Loading indicators
- Graceful error recovery
- Consistent UI patterns

### Performance
- Efficient token management
- Minimal API calls
- Optimized validation
- Fast error responses
- Proper caching

## Future Enhancements

### Planned Features
- **Social Login**: Google, Facebook integration
- **Biometric Auth**: Fingerprint/Face ID support
- **Session Management**: Multiple device sessions
- **Security Alerts**: Suspicious activity notifications
- **Password Reset**: Self-service password recovery

### Scalability
- **Redis Caching**: Session and token caching
- **Load Balancing**: Multiple auth servers
- **Database Optimization**: Indexed queries
- **CDN Integration**: Static asset delivery
- **Monitoring**: Advanced security monitoring

## Troubleshooting

### Common Issues
1. **Email Delivery**: Check SMTP configuration
2. **Token Expiration**: Verify JWT settings
3. **CORS Issues**: Update allowed origins
4. **2FA Problems**: Check email templates
5. **Validation Errors**: Review validation rules

### Debug Tools
- Django admin for user management
- API documentation with Swagger
- Browser developer tools
- Mobile app debugging
- Server logs and monitoring

This authentication system provides enterprise-grade security while maintaining excellent user experience for the AgriLink platform.
