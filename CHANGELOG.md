# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-12

### 🔒 Security
- **BREAKING**: Replaced SHA-256 with bcrypt for password hashing
- Added command injection protection using fluent-ffmpeg
- Implemented path traversal prevention with strict validation
- Added login attempt limiting (5 attempts, 15-minute lockout)
- Implemented rate limiting for API endpoints
- Added Helmet.js for security headers
- Added SSRF protection to block internal network access

### ⚡ Performance
- Improved caching system with automatic save and expiration
- Added gzip compression for HTTP responses
- Implemented streaming for video processing
- Added Sharp for optimized image processing
- Automatic cleanup of temporary files older than 1 hour

### ✨ Features
- Added multiple thumbnail position options (start/middle/end/auto)
- Added health check endpoint (`/api/health`)
- Added metrics endpoint (`/api/metrics`)
- Added password strength validation
- Implemented automatic password migration from v1.x
- Added support for custom thumbnail quality settings
- Added XML escaping for NFO file generation

### 🐳 DevOps
- Added complete Docker support with Dockerfile
- Added docker-compose.yml configuration
- Added .dockerignore for optimized builds
- Implemented graceful shutdown handling
- Added health checks for Docker/Kubernetes

### 📝 Documentation
- Complete README rewrite with v2.0 features
- Added comprehensive API documentation
- Added troubleshooting guide
- Added security best practices
- Added performance optimization tips

### 🛠️ Development
- Added ESLint configuration
- Added Prettier configuration
- Added Jest test framework setup
- Added .gitignore for better repository management
- Added .env.example template
- Upgraded all dependencies to latest versions

### 🔧 Configuration
- Added comprehensive environment variable support
- Added new configuration options for thumbnails
- Added security configuration options
- Added logging configuration with rotation
- Increased default FFmpeg timeout from 25s to 30s

### 📦 Dependencies
- Added `bcrypt` (^5.1.1) - Secure password hashing
- Added `fluent-ffmpeg` (^2.1.2) - FFmpeg wrapper
- Added `validator` (^13.11.0) - Input validation
- Added `dotenv` (^16.3.1) - Environment variables
- Added `express-rate-limit` (^7.1.5) - Rate limiting
- Added `helmet` (^7.1.0) - Security headers
- Added `joi` (^17.11.0) - Schema validation
- Added `lru-cache` (^10.1.0) - LRU cache
- Added `sharp` (^0.33.1) - Image processing
- Added `winston` (^3.11.0) - Logging
- Added `winston-daily-rotate-file` (^4.7.1) - Log rotation
- Added `compression` (^1.7.4) - HTTP compression

### 🐛 Bug Fixes
- Fixed potential command injection vulnerabilities
- Fixed path traversal vulnerabilities
- Fixed session management issues
- Fixed cache not saving on graceful shutdown
- Fixed temporary file cleanup
- Improved error handling throughout application

### ⚠️ Breaking Changes
- Password hashing changed from SHA-256 to bcrypt (automatic migration available)
- Changed default HOST from 'localhost' to '0.0.0.0' for Docker compatibility
- API responses now include more detailed error information
- Session tokens may be invalidated after upgrade

### 📋 Migration Guide from v1.x

#### Automatic Migration
1. Start v2.0 - old SHA-256 passwords still work
2. Login with existing credentials
3. Change password - automatically upgrades to bcrypt
4. Done!

#### Manual Migration (if issues occur)
1. Backup your data
2. Delete `auth.json`
3. Restart application
4. Login with default credentials
5. Change password immediately

---

## [1.0.0] - 2024-XX-XX

### Initial Release
- Basic thumbnail generation from .strm files
- NFO file creation
- User authentication
- Concurrent processing
- Video duration caching
- Web-based UI
- Real-time progress tracking via SSE

---

[2.0.0]: https://github.com/yourusername/emby-thumbnail-manager/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/yourusername/emby-thumbnail-manager/releases/tag/v1.0.0
