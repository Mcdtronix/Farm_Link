"""
tomato_grading_api/middleware.py
━━━━━━━━━━────────────────────────
Debugging middleware for API requests
"""

import logging
import time
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('tomato_grading_api')

class DebugRequestMiddleware(MiddlewareMixin):
    """
    Middleware to log all API requests and responses for debugging.
    """
    
    def process_request(self, request):
        """Log incoming request details."""
        request.start_time = time.time()
        
        # Log request details
        logger.info(f"🔥 INCOMING REQUEST:")
        logger.info(f"   Method: {request.method}")
        logger.info(f"   URL: {request.get_full_path()}")
        logger.info(f"   Headers: {dict(request.headers)}")
        logger.info(f"   Body: {request.body if hasattr(request, 'body') else 'No body'}")
        logger.info(f"   User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}")
        logger.info(f"   IP Address: {self.get_client_ip(request)}")
        
        # Special logging for CORS preflight
        if request.method == 'OPTIONS':
            logger.info(f"🌐 CORS PREFLIGHT REQUEST DETECTED")
            logger.info(f"   Origin: {request.META.get('HTTP_ORIGIN', 'No origin')}")
            logger.info(f"   Requested Method: {request.META.get('HTTP_ACCESS_CONTROL_REQUEST_METHOD', 'No method')}")
            logger.info(f"   Requested Headers: {request.META.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS', 'No headers')}")
        
        return None
    
    def process_response(self, request, response):
        """Log response details."""
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            logger.info(f"📤 OUTGOING RESPONSE:")
            logger.info(f"   Status Code: {response.status_code}")
            logger.info(f"   Duration: {duration:.3f}s")
            logger.info(f"   Headers: {dict(response.items())}")
            
            # Log CORS headers specifically
            cors_headers = {
                'Access-Control-Allow-Origin': response.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.get('Access-Control-Allow-Headers'),
                'Access-Control-Allow-Credentials': response.get('Access-Control-Allow-Credentials'),
            }
            logger.info(f"   CORS Headers: {cors_headers}")
            
            # Log response content for small responses
            if hasattr(response, 'content') and len(response.content) < 1000:
                try:
                    content = response.content.decode('utf-8')
                    logger.info(f"   Content: {content}")
                except UnicodeDecodeError:
                    logger.info(f"   Content: [Binary data, {len(response.content)} bytes]")
        
        return response
    
    def get_client_ip(self, request):
        """Get the client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class AuthenticationDebugMiddleware(MiddlewareMixin):
    """
    Middleware specifically for debugging authentication flows.
    """
    
    def process_request(self, request):
        """Log authentication-related requests."""
        if '/auth/' in request.get_full_path():
            logger.info(f"🔐 AUTH REQUEST DETECTED:")
            logger.info(f"   Endpoint: {request.get_full_path()}")
            logger.info(f"   Method: {request.method}")
            
            # Log JWT tokens if present
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
                logger.info(f"   JWT Token: {token[:20]}...{token[-10:] if len(token) > 30 else token}")
            else:
                logger.info(f"   No JWT token found")
        
        return None
