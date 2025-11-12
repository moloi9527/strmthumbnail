/**
 * 封面自动生成器 - 主服务器文件
 * 增强版 v2.0
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// 加载环境变量
require('dotenv').config();

// 导入配置和工具
const config = require('./src/config');
const Logger = require('./src/utils/logger');

// 导入服务
const AuthService = require('./src/services/authService');
const CacheService = require('./src/services/cacheService');
const VideoService = require('./src/services/videoService');

// 导入中间件
const createAuthMiddleware = require('./src/middleware/auth');
const createRequestLogger = require('./src/middleware/requestLogger');
const createErrorHandler = require('./src/middleware/errorHandler');

// 导入路由
const createAuthRoutes = require('./src/routes/auth');
const createVideoRoutes = require('./src/routes/video');

// 初始化应用
const app = express();
const PORT = config.get('port');
const HOST = config.get('host');

// 初始化日志
const logger = new Logger({
  level: config.get('logLevel'),
  logFile: config.get('logFile'),
  enableConsole: true,
  enableFile: true
});

// 初始化服务
const authService = new AuthService(config, logger);
const cacheService = new CacheService(config, logger);
const videoService = new VideoService(config, logger, cacheService);

// 安全中间件
if (config.get('enableHelmet')) {
  app.use(helmet({
    contentSecurityPolicy: false, // 允许内联脚本（因为前端使用 CDN）
    crossOriginEmbedderPolicy: false
  }));
}

// 启用 CORS
if (config.get('enableCors')) {
  app.use(cors());
}

// 启用 gzip 压缩
app.use(compression());

// 速率限制
if (config.get('enableRateLimit')) {
  const limiter = rateLimit({
    windowMs: config.get('rateLimitWindow'),
    max: config.get('rateLimitMax'),
    message: '请求过于频繁，请稍后再试',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);
}

// Body 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use(createRequestLogger(logger));

// 托管前端文件
app.use(express.static('public'));

// 创建认证中间件
const authMiddleware = createAuthMiddleware(authService, logger);

// 健康检查端点（无需认证）
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      cache: {
        status: 'ok',
        size: cacheService.size()
      },
      sessions: authService.getSessionStats()
    },
    memory: process.memoryUsage(),
    version: require('./package.json').version
  };

  res.status(200).json(healthCheck);
});

// 指标端点（需要认证）
app.get('/api/metrics', authMiddleware, (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheService.getStats(),
    sessions: authService.getSessionStats(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

// 注册路由
app.use('/api/auth', createAuthRoutes(authService, authMiddleware));
app.use('/api', createVideoRoutes(videoService, authMiddleware, logger, config));

// 错误处理中间件
app.use(createErrorHandler(logger));

/**
 * 初始化所有服务
 */
async function initializeServices() {
  try {
    logger.info('正在初始化服务...');

    // 初始化认证服务
    await authService.init();

    // 初始化缓存服务
    await cacheService.init();

    // 初始化视频服务
    await videoService.init();

    // 启动会话清理定时器（每小时清理一次）
    setInterval(() => {
      authService.cleanExpiredSessions();
    }, 60 * 60 * 1000);

    // 启动缓存清理定时器（每天清理一次）
    setInterval(() => {
      cacheService.cleanOldEntries(config.get('cacheMaxAge'));
    }, 24 * 60 * 60 * 1000);

    logger.info('所有服务初始化完成');
  } catch (err) {
    logger.error('服务初始化失败', { error: err.message });
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
async function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号，正在关闭服务器...`);

  try {
    // 保存缓存
    await cacheService.close();

    // 清理临时文件
    await videoService.cleanTempDir();

    logger.info('服务器已安全关闭');
    process.exit(0);
  } catch (err) {
    logger.error('关闭服务器时出错', { error: err.message });
    process.exit(1);
  }
}

// 注册信号处理
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', {
    error: err.message,
    stack: err.stack
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', {
    reason: reason,
    promise: promise
  });
});

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // 初始化所有服务
    await initializeServices();

    // 启动 HTTP 服务器
    app.listen(PORT, HOST, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`🚀 Emby 封面生成器 v${require('./package.json').version}`);
      logger.info(`📡 监听地址: ${HOST}:${PORT}`);
      logger.info(`🌐 API 地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api`);
      logger.info(`📁 前端地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      logger.info(`💚 健康检查: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health`);
      logger.info(`🔐 认证已启用`);
      logger.info(`🛡️  安全功能: Helmet=${config.get('enableHelmet')}, RateLimit=${config.get('enableRateLimit')}`);
      logger.info(`📊 日志级别: ${config.get('logLevel')}`);
      logger.info(`🗄️  缓存大小: ${cacheService.size()} 条记录`);
      logger.info(`🌍 运行环境: ${config.get('env')}`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  } catch (err) {
    logger.error('启动服务器失败', { error: err.message });
    process.exit(1);
  }
}

// 启动应用
startServer();

module.exports = app;
