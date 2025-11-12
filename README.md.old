# 📹 STRM 视频封面自动生成器

一个强大的自动化工具，用于从 `.strm` 文件中的视频链接自动生成封面图片和 NFO 元数据文件。采用模块化架构，支持智能并发处理、缓存优化和完善的日志系统。

## ✨ 功能特性

- 🎬 **自动封面生成** - 从视频中间帧自动截取封面
- 📄 **NFO 文件创建** - 自动生成媒体元数据文件
- ⚡ **智能并发处理** - 根据文件数量动态调整并发数
- 💾 **缓存优化** - 视频时长缓存，避免重复探测
- 🔄 **批量处理** - 支持批量扫描和处理
- 📊 **实时进度** - 使用 SSE 流式传输处理进度
- 🔐 **用户认证** - 安全的用户登录和会话管理
- 📝 **完善日志** - 多级别日志系统，支持文件输出
- 🎨 **现代 UI** - 基于 React 的响应式界面

## 📋 系统要求

### 必需软件

- **Node.js** >= 14.0.0
- **FFmpeg** >= 4.0
- **curl** (通常系统自带)

### 操作系统

- ✅ Linux
- ✅ macOS
- ✅ Windows (使用 WSL 或 Git Bash)

## 🚀 快速开始

### 1. 安装依赖

首先克隆或下载项目，然后安装依赖：

```bash
# 进入项目目录
cd strmthumbnail

# 安装 Node.js 依赖
npm install
```

### 2. 安装系统依赖

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg curl
```

**macOS:**
```bash
brew install ffmpeg curl
```

**Windows:**
- 下载并安装 [FFmpeg](https://ffmpeg.org/download.html)
- 确保 `ffmpeg` 和 `curl` 在系统 PATH 中

### 3. 配置（可选）

项目提供了两种配置方式：

#### 方式 1：使用环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

#### 方式 2：使用配置文件

```bash
# 复制配置文件模板
cp config.example.json config.json

# 编辑配置文件
nano config.json
```

### 4. 启动服务

```bash
# 使用新的模块化版本（推荐）
node server.new.js

# 或者使用 npm
npm start
```

启动成功后，你会看到：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 封面生成器服务已启动
📡 监听端口: 3000
🌐 API 地址: http://localhost:3000/api
📁 前端地址: http://localhost:3000
🔐 认证已启用
📊 日志级别: info
🗄️  缓存大小: 0 条记录
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5. 访问应用

打开浏览器访问：**http://localhost:3000**

默认登录信息：
- **用户名**: `admin`
- **密码**: `emby123456`

⚠️ **首次登录后请立即修改密码！**

## 📖 使用说明

### 基本工作流程

1. **登录系统**
   - 使用默认账号或自定义账号登录

2. **配置参数**
   - 设置 `.strm 文件目录`（必填）
   - 设置封面输出目录（可选，留空则保存到 .strm 同级目录）
   - 选择封面生成模式：
     - **仅生成缺失封面**（推荐）：跳过已有封面的文件
     - **覆盖所有已有封面**：重新生成所有封面
   - 设置并发线程数（建议 2-8）
   - 设置最大重试次数（建议 1-2）

3. **保存配置**
   - 点击"保存配置"按钮保存设置

4. **开始处理**
   - 点击"开始处理"按钮
   - 实时查看处理进度和日志
   - 等待所有文件处理完成

5. **查看结果**
   - 查看成功/失败统计
   - 下载日志文件
   - 对失败的文件进行重试

### 文件浏览器

- 点击 `.strm 文件目录` 旁边的文件夹图标
- 浏览文件系统选择目录
- 点击目录名称进入
- 点击 `..` 返回上级目录

### 修改密码

- 登录后点击右上角的钥匙图标
- 输入原密码和新密码
- 点击确认修改

## ⚙️ 配置说明

### 环境变量配置

在 `.env` 文件中可以配置以下参数：

```bash
# 服务器配置
PORT=3000                    # 服务器端口
HOST=localhost               # 监听地址
NODE_ENV=production          # 环境模式

# 认证配置
DEFAULT_USERNAME=admin       # 默认用户名
DEFAULT_PASSWORD=emby123456  # 默认密码
SESSION_EXPIRY=86400000      # 会话过期时间（毫秒）

# 路径配置
TMP_DIR=/tmp/emby_thumb_temp # 临时文件目录
CACHE_FILE=./.video_cache.json    # 缓存文件路径
AUTH_CONFIG_FILE=./auth.json      # 认证配置文件

# 并发配置
DEFAULT_CONCURRENCY=4        # 默认并发数
MAX_CONCURRENCY=8            # 最大并发数
MIN_CONCURRENCY=2            # 最小并发数

# 超时配置（毫秒）
FFPROBE_TIMEOUT=10000        # ffprobe 超时
FFMPEG_TIMEOUT=25000         # ffmpeg 超时
CURL_TIMEOUT=20000           # curl 超时
HTTP_TIMEOUT=8000            # HTTP 请求超时

# 日志配置
LOG_LEVEL=info               # 日志级别
LOG_FILE=./logs/app.log      # 日志文件路径
```

### 日志级别说明

- `error` - 仅显示错误信息
- `warn` - 显示警告和错误
- `info` - 显示信息、警告和错误（推荐）
- `debug` - 显示所有日志（用于调试）

### 并发数建议

根据你的 CPU 核心数设置：

| CPU 核心数 | 推荐并发数 |
|-----------|-----------|
| 1-2 核 | 2-3 |
| 4 核 | 4-6 |
| 8 核及以上 | 6-8 |

## 📁 项目结构

```
strmthumbnail/
├── src/                    # 源代码
│   ├── config/            # 配置管理
│   ├── middleware/        # 中间件
│   ├── routes/            # 路由
│   ├── services/          # 业务逻辑服务
│   └── utils/             # 工具类
├── public/                # 前端静态文件
│   └── index.html         # 单页应用
├── logs/                  # 日志目录（自动创建）
├── server.new.js          # 主服务器文件（模块化版本）
├── server.js              # 旧服务器文件（已废弃）
├── package.json           # 项目配置
├── .env.example           # 环境变量模板
├── config.example.json    # 配置文件模板
└── README.md              # 项目说明
```

## 🔧 高级功能

### 使用配置文件启动

```bash
# 使用自定义配置文件
node server.new.js

# 配置会自动从 config.json 加载
```

### 查看日志

```bash
# 实时查看日志
tail -f logs/app.log

# 查看最近 100 行
tail -n 100 logs/app.log

# 搜索错误日志
grep ERROR logs/app.log
```

### 调试模式

```bash
# 启用调试日志
LOG_LEVEL=debug node server.new.js

# 或者设置环境变量
export LOG_LEVEL=debug
npm start
```

### 清理缓存

如果需要清理视频时长缓存：

```bash
# 删除缓存文件
rm .video_cache.json

# 重启服务
npm start
```

### 清理临时文件

```bash
# Linux/macOS
rm -rf /tmp/emby_thumb_temp/*

# Windows
del /Q C:\Users\YourName\AppData\Local\Temp\emby_thumb_temp\*
```

## 🐛 故障排除

### 1. FFmpeg 未找到

**错误信息：** `ffmpeg: command not found`

**解决方案：**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# 下载并安装 FFmpeg，添加到系统 PATH
```

### 2. 端口被占用

**错误信息：** `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案：**
```bash
# 方式 1: 更换端口
PORT=3001 npm start

# 方式 2: 杀死占用进程
# Linux/macOS
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### 3. 视频链接无法访问

**可能原因：**
- 视频链接已失效
- 网络连接问题
- 防火墙阻止

**解决方案：**
- 检查视频链接是否可以在浏览器中打开
- 检查网络连接
- 检查防火墙设置
- 增加超时时间：`HTTP_TIMEOUT=15000`

### 4. 临时目录权限问题

**错误信息：** `EACCES: permission denied`

**解决方案：**
```bash
# Linux/macOS
sudo chmod 777 /tmp/emby_thumb_temp

# 或者使用自定义临时目录
TMP_DIR=/home/user/temp npm start
```

### 5. 日志文件写入失败

**解决方案：**
```bash
# 创建日志目录
mkdir -p logs
chmod 755 logs

# 或者禁用文件日志
# 编辑 server.new.js，设置 enableFile: false
```

## 📊 性能优化建议

### 1. 并发数调整

- **小文件量（< 10）**：使用 2-3 并发
- **中等文件量（10-100）**：使用 4-6 并发
- **大文件量（> 100）**：使用 6-8 并发

### 2. 缓存优化

- 定期备份缓存文件 `.video_cache.json`
- 缓存会自动保存，无需手动操作
- 缓存会持久化到磁盘，重启后自动加载

### 3. 网络优化

- 对于慢速网络，增加超时时间：
  ```bash
  CURL_TIMEOUT=30000
  HTTP_TIMEOUT=15000
  ```

### 4. 内存优化

- 大量文件处理时，建议分批处理
- 每批 100-200 个文件
- 处理完一批后重启服务清理内存

## 🔒 安全建议

### 1. 修改默认密码

**首次登录后立即修改密码：**
- 点击右上角钥匙图标
- 输入原密码：`emby123456`
- 设置强密码（建议 12+ 字符，包含大小写字母、数字和符号）

### 2. 使用环境变量

不要在代码中硬编码敏感信息，使用环境变量：

```bash
DEFAULT_PASSWORD=your_strong_password
```

### 3. 限制访问

如果在生产环境使用，建议：
- 使用防火墙限制访问
- 配置 Nginx 反向代理
- 启用 HTTPS

### 4. 定期更新

定期更新依赖包：

```bash
npm update
npm audit fix
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [FFmpeg](https://ffmpeg.org/) - 强大的视频处理工具
- [Express](https://expressjs.com/) - Node.js Web 框架
- [React](https://reactjs.org/) - 用户界面库

## 📞 支持

如果遇到问题：

1. 查看 [故障排除](#-故障排除) 部分
2. 查看日志文件 `logs/app.log`
3. 提交 Issue 并附上：
   - 错误信息
   - 日志文件
   - 系统环境信息

## 🗺️ 路线图

### 已完成 ✅
- [x] 自动封面生成
- [x] NFO 文件创建
- [x] 智能并发处理
- [x] 缓存优化
- [x] 用户认证
- [x] 日志系统
- [x] 模块化重构

### 计划中 🚧
- [ ] 多种截图位置选择（开始/中间/结尾）
- [ ] 图片处理（压缩、缩放、水印）
- [ ] 在线 API 获取海报（TMDB/OMDB）
- [ ] 定时任务和自动扫描
- [ ] Docker 容器化
- [ ] 单元测试覆盖
- [ ] API 文档（Swagger）

---

**版本**: 2.0.0 (模块化重构版)
**最后更新**: 2025-01-01
**作者**: Claude Code
