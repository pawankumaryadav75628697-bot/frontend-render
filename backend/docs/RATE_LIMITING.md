# Rate Limiting Configuration

## Overview
The application uses Express Rate Limit to prevent abuse and ensure fair usage of the API.

## Configuration

The application uses express-rate-limit v6+ with modern configuration standards.

### Development Mode
- **General API Endpoints**: 50,000 requests per minute
- **Authentication Endpoints**: 1,000 requests per minute  
- **Window**: 1 minute
- **Reset**: Automatic after window expires
- **Headers**: RFC draft-7 standard headers

### Production Mode
- **General API Endpoints**: 1,000 requests per 15 minutes
- **Authentication Endpoints**: 10 requests per 15 minutes
- **Window**: 15 minutes
- **Reset**: Automatic after window expires
- **Headers**: RFC draft-7 standard headers

## Exempted Endpoints
The following endpoints are exempt from rate limiting:
- `/api/health` - Health check endpoint
- `/api/v1/test` - Testing endpoint
- `/api/dev/*` - Development utility endpoints

## Troubleshooting

### 429 Too Many Requests Error
If you encounter this error:

1. **Wait for Reset**: Wait for the rate limit window to expire
2. **Development Reset** (dev only): Call `POST /api/dev/reset-rate-limit`
3. **Check Environment**: Ensure `NODE_ENV` is set correctly
4. **Review Requests**: Check if you're making excessive requests

### Rate Limit Headers
The API returns rate limit information in response headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Time when limit resets

### Best Practices
1. **Implement Retry Logic**: Wait and retry after rate limit expires
2. **Cache Responses**: Avoid repeated identical requests
3. **Batch Operations**: Combine multiple operations when possible
4. **Monitor Headers**: Check rate limit headers to prevent hitting limits

## Development Utilities

### Reset Rate Limits (Development Only)
```bash
curl -X POST http://localhost:5001/api/dev/reset-rate-limit
```

### Check Rate Limit Status
```bash
curl -I http://localhost:5001/api/v1/test
```
Look for `RateLimit-*` headers in the response.