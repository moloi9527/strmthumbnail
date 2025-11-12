# 📹 Emby 视频封面自动生成器 v2.0

> 强大的自动化工具，用于从 `.strm` 文件中的视频链接自动生成封面图片和 NFO 元数据文件

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/yourusername/emby-thumbnail-manager)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

---

## ✨ v2.0 新版本亮点

### 🔒 安全增强
- ✅ **bcrypt 密码哈希** - 替代 SHA-256，抗彩虹表攻击
- ✅ **命令注入防护** - 使用 fluent-ffmpeg 替代直接命令行调用
- ✅ **路径遍历防护** - 严格的路径验证，防止访问系统目录
- ✅ **登录失败限制** - 5次失败锁定15分钟，防暴力破解
- ✅ **速率限制** - API 请求频率限制（100次/15分钟）
- ✅ **Helmet 安全头** - HTTP 安全头保护
- ✅ **SSRF 防护** - 禁止访问内网地址

### ⚡ 性能优化
- ✅ **改进的缓存系统** - 带自动保存和过期清理
- ✅ **gzip 压缩** - 减少50%+ 网络传输
- ✅ **流式处理** - 优化内存使用
- ✅ **Sharp 图片处理** - 更快的图片压缩和优化
- ✅ **资源清理** - 自动清理超过1小时的临时文件

### 🎨 功能增强
- ✅ **多截图位置** - 开始/中间/结尾/智能自动选择
- ✅ **图片后处理** - MozJPEG 优化，更小体积更高质量
- ✅ **健康检查** - `/api/health` 端点，Docker/K8s 友好
- ✅ **监控指标** - CPU、内存、缓存统计
- ✅ **密码强度检查** - 确保密码安全
- ✅ **旧密码自动迁移** - 平滑升级体验

### 🐳 运维友好
- ✅ **Docker 支持** - 完整的 Dockerfile 和 docker-compose.yml
- ✅ **优雅关闭** - SIGTERM/SIGINT 处理，安全保存数据
- ✅ **详细日志** - Winston 结构化日志，自动轮转
- ✅ **配置验证** - 启动时检查所有配置项
- ✅ **环境变量** - 完整的 .env 支持

---

## 🚀 快速开始

### 方式 1: Docker (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/emby-thumbnail-manager.git
cd emby-thumbnail-manager

# 2. 配置环境变量
cp .env.example .env
nano .env  # 修改默认密码等配置

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 访问应用
# 浏览器打开: http://localhost:3000
```

### 方式 2: 本地安装

```bash
# 1. 安装系统依赖
# Ubuntu/Debian:
sudo apt update && sudo apt install ffmpeg

# macOS:
brew install ffmpeg

# 2. 安装 Node.js 依赖
npm install

# 3. 配置环境
cp .env.example .env

# 4. 启动服务
npm start
```

### 默认登录

- **用户名**: `admin`
- **密码**: `emby123456`

⚠️ **首次登录后请立即修改密码！**

---

## 📖 完整使用指南

### 基本流程

1. **登录系统** → 2. **配置参数** → 3. **扫描文件** → 4. **开始处理** → 5. **查看结果**

### 配置说明

#### STRM 文件目录（必填）
包含 `.strm` 文件的目录路径，例如：
- `/media/movies`
- `/mnt/video/series`

#### 封面输出目录（可选）
- 留空：保存到 .strm 文件同级目录
- 指定：保存到指定目录

#### 截图位置选择
- **开始** (start): 视频开头约 5 秒位置
- **中间** (middle): 视频 50% 位置（默认，推荐）
- **结尾** (end): 视频 95% 位置
- **自动** (auto): 随机选择 10%-90% 之间位置

#### 并发数调整

| CPU 核心数 | 推荐设置 |
|-----------|---------|
| 1-2 核 | 2-3 |
| 4 核 | 4-6 |
| 8 核及以上 | 6-8 |

---

## ⚙️ 配置文件

### 环境变量 (.env)

```bash
# 服务器
PORT=3000
HOST=0.0.0.0

# 认证（请修改默认密码！）
DEFAULT_USERNAME=admin
DEFAULT_PASSWORD=your_secure_password_here

# 缩略图质量
THUMBNAIL_QUALITY=85
MAX_THUMBNAIL_WIDTH=1920
MAX_THUMBNAIL_HEIGHT=1080
DEFAULT_THUMBNAIL_POSITION=middle

# 性能
DEFAULT_CONCURRENCY=4
FFMPEG_TIMEOUT=30000

# 安全
ENABLE_HELMET=true
ENABLE_RATE_LIMIT=true
```

完整配置请参考 `.env.example`

---

## 🐳 Docker 部署

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - /your/media/path:/media:ro  # 挂载媒体目录（只读）
    environment:
      - DEFAULT_PASSWORD=your_password
    restart: unless-stopped
```

### 常用命令

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重启
docker-compose restart

# 停止
docker-compose down

# 重新构建
docker-compose up -d --build
```

---

## 📊 API 文档

### 健康检查

```bash
GET /api/health

# 响应
{
  "status": "ok",
  "uptime": 12345,
  "version": "2.0.0",
  "services": {
    "cache": { "status": "ok", "size": 100 },
    "sessions": { "total": 1, "active": 1 }
  }
}
```

### 认证

```bash
# 登录
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}

# 响应
{
  "success": true,
  "token": "...",
  "username": "admin"
}
```

### 视频处理

```bash
# 扫描文件
POST /api/scan
Authorization: Bearer <token>

{
  "directory": "/media/movies"
}

# 处理文件（SSE 流）
POST /api/process
Authorization: Bearer <token>

{
  "files": ["file1.strm", "file2.strm"],
  "config": {
    "coverMode": "1",
    "thumbnailPosition": "middle",
    "thumbnailQuality": 85
  }
}
```

---

## 🔧 故障排除

### 常见问题

#### 1. FFmpeg 未找到
```bash
# Ubuntu
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# 验证
ffmpeg -version
```

#### 2. 端口被占用
```bash
# 更换端口
PORT=3001 npm start

# 或杀死占用进程
lsof -ti:3000 | xargs kill -9
```

#### 3. 权限错误
```bash
chmod 755 ./logs ./data
chmod 777 /tmp/emby_thumb_temp
```

#### 4. 从 v1.x 升级后无法登录

旧版本使用 SHA-256，新版本自动检测并提示更新。

**解决方案1**: 登录后修改密码，系统会自动升级到 bcrypt

**解决方案2**: 删除 `auth.json`，重启服务创建新账号

---

## 🔒 安全建议

### 1. 修改默认密码
首次登录后立即修改，新密码要求：
- 至少 8 个字符
- 12 字符以下需包含大小写字母、数字、特殊字符中的 3 种
- 12 字符及以上无复杂度要求

### 2. 使用 HTTPS
生产环境使用 Nginx 反向代理并配置 SSL：

```nginx
server {
    listen 443 ssl;
    server_name thumbnail.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 限制访问
使用防火墙或 IP 白名单限制访问

### 4. 定期更新
```bash
npm update
npm audit fix
```

---

## 📈 性能优化建议

### 1. 使用 SSD
```bash
TMP_DIR=/path/to/ssd/tmp
```

### 2. 调整缓存
```bash
CACHE_SAVE_INTERVAL=60000  # 1分钟
CACHE_MAX_AGE=7776000000   # 90天
```

### 3. 网络优化
```bash
# 慢速网络增加超时
FFPROBE_TIMEOUT=20000
FFMPEG_TIMEOUT=60000
HTTP_TIMEOUT=15000
```

### 4. 批量处理
大量文件分批处理（每批 100-200 个）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程
```bash
# 1. Fork 项目
# 2. 创建特性分支
git checkout -b feature/your-feature

# 3. 提交更改
git commit -m "Add some feature"

# 4. 推送到分支
git push origin feature/your-feature

# 5. 创建 Pull Request
```

### 代码规范
```bash
npm run lint      # 代码检查
npm run format    # 代码格式化
npm test          # 运行测试
```

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [FFmpeg](https://ffmpeg.org/)
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- [Sharp](https://sharp.pixelplumbing.com/)
- [Express](https://expressjs.com/)
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js)

---

## 🗺️ 路线图

### ✅ v2.0 (当前)
- [x] 安全增强
- [x] 性能优化
- [x] Docker 支持
- [x] 多截图位置

### 🚧 v2.1 (计划中)
- [ ] 多用户支持
- [ ] 封面质量评分
- [ ] 批量编辑
- [ ] 定时任务

### 🔮 v3.0 (未来)
- [ ] TMDB/OMDB API 集成
- [ ] AI 智能选图
- [ ] 分布式处理
- [ ] 移动端应用

---

**版本**: 2.0.0
**更新**: 2025-01-12
**维护**: Claude Code & Contributors

**项目主页**: https://github.com/yourusername/emby-thumbnail-manager
**问题反馈**: https://github.com/yourusername/emby-thumbnail-manager/issues
