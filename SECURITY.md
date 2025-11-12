# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

We take the security of Emby Thumbnail Manager seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us at: **security@example.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release
- **Disclosure**: After fix is released

### Bug Bounty

We currently do not offer a bug bounty program, but we deeply appreciate security researchers' efforts and will publicly acknowledge contributors (with permission).

## Security Features

### Current Protections

#### Authentication & Authorization
- ✅ bcrypt password hashing (12 rounds)
- ✅ Session-based authentication
- ✅ Login attempt rate limiting (5 attempts, 15-min lockout)
- ✅ Session expiration (24 hours default)
- ✅ Password strength validation

#### Input Validation
- ✅ Path traversal prevention
- ✅ Command injection protection (using fluent-ffmpeg)
- ✅ URL validation with SSRF protection
- ✅ Request body validation
- ✅ File type validation

#### Network Security
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Rate limiting (100 req/15min)
- ✅ Body size limits (10MB)
- ✅ HTTPS support (via reverse proxy)

#### Data Protection
- ✅ Secure session storage
- ✅ XML escaping in NFO files
- ✅ No sensitive data in logs (production)
- ✅ Automatic session cleanup

#### Infrastructure
- ✅ Graceful shutdown handling
- ✅ Error handling without information leakage
- ✅ Health check endpoints
- ✅ Docker security best practices

### Known Limitations

⚠️ **Current Limitations**:
- Session storage is in-memory (lost on restart)
- Single-user authentication system
- No two-factor authentication (2FA)
- No audit logging for security events
- No IP-based access control

These limitations are planned to be addressed in future versions.

## Security Best Practices for Users

### 1. Change Default Credentials

**Immediately after installation**:
```bash
# Login with default credentials
# Username: admin
# Password: emby123456

# Click the key icon → Change Password
```

### 2. Use Strong Passwords

Requirements:
- Minimum 8 characters
- For passwords < 12 characters: Must contain 3 of 4:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special characters (!@#$%^&*)

Recommended:
- Use 12+ characters
- Use a password manager
- Avoid common words or patterns

### 3. Secure Deployment

#### Use HTTPS

Deploy behind a reverse proxy with SSL:

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name thumbnail.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable

# Block direct access to application port
iptables -A INPUT -p tcp --dport 3000 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

#### Docker Security

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: emby-thumbnail-manager:latest
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - ./data:/app/data:rw
      - ./logs:/app/logs:rw
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    user: "1000:1000"  # Run as non-root user
```

### 4. Keep Updated

```bash
# Check for updates regularly
git fetch origin
git log HEAD..origin/main --oneline

# Update dependencies
npm update
npm audit fix

# Rebuild Docker image
docker-compose build --no-cache
docker-compose up -d
```

### 5. Monitor Logs

```bash
# Watch for suspicious activity
tail -f logs/app.log | grep "ERROR\|WARN"

# Failed login attempts
grep "登录失败" logs/app.log

# Locked accounts
grep "账号已被锁定" logs/app.log
```

### 6. Backup Data

```bash
# Regular backups
backup_dir="backup_$(date +%Y%m%d)"
mkdir -p $backup_dir
cp auth.json .video_cache.json $backup_dir/
cp -r data/ $backup_dir/
tar -czf $backup_dir.tar.gz $backup_dir/
```

### 7. Network Segmentation

- Run on isolated network if possible
- Use VPN for remote access
- Implement IP whitelisting

### 8. Environment Variables

```bash
# Never commit .env to version control
echo ".env" >> .gitignore

# Use strong secrets
DEFAULT_PASSWORD=$(openssl rand -base64 32)

# Limit permissions
chmod 600 .env
chmod 600 auth.json
```

## Security Checklist

### Pre-Deployment

- [ ] Changed default credentials
- [ ] Configured strong password
- [ ] Reviewed environment variables
- [ ] Configured HTTPS/reverse proxy
- [ ] Set up firewall rules
- [ ] Configured proper file permissions
- [ ] Reviewed Docker security settings (if using Docker)

### Post-Deployment

- [ ] Verified HTTPS is working
- [ ] Tested login with new credentials
- [ ] Verified rate limiting is active
- [ ] Checked logs for errors
- [ ] Confirmed health check endpoint works
- [ ] Set up monitoring/alerting
- [ ] Created backup procedure

### Ongoing

- [ ] Monitor logs regularly
- [ ] Check for security updates monthly
- [ ] Update dependencies monthly
- [ ] Backup data weekly
- [ ] Review access logs monthly
- [ ] Rotate credentials periodically

## Vulnerability Disclosure Timeline

When we receive a security report:

1. **Day 0**: Vulnerability reported
2. **Day 1-2**: Initial acknowledgment and assessment
3. **Day 7**: Assessment complete, fix planned
4. **Day 7-30**: Fix development and testing
5. **Day 30**: Patch release
6. **Day 30+**: Public disclosure (coordinated with reporter)

## Security Updates

Subscribe to security updates:
- Watch the repository for releases
- Check CHANGELOG.md regularly
- Follow us on Twitter/X: @example (if applicable)

## Hall of Fame

We appreciate security researchers who help improve our security:

<!-- Contributors will be listed here after disclosure -->

---

**Last Updated**: 2025-01-12
**Security Contact**: security@example.com
**GPG Key**: [Available upon request]
