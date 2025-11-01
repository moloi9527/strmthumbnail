/**
 * 封面自动生成器 - 主服务器文件
 * 模块化重构版本
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

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

// 中间件
app.use(cors());
app.use(express.json());
app.use(createRequestLogger(logger));

// 托管前端文件
app.use(express.static('public'));

// 创建认证中间件
const authMiddleware = createAuthMiddleware(authService, logger);

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
      cacheService.cleanOldEntries();
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
    app.listen(PORT, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`🚀 封面生成器服务已启动`);
      logger.info(`📡 监听端口: ${PORT}`);
      logger.info(`🌐 API 地址: http://localhost:${PORT}/api`);
      logger.info(`📁 前端地址: http://localhost:${PORT}`);
      logger.info(`🔐 认证已启用`);
      logger.info(`📊 日志级别: ${config.get('logLevel')}`);
      logger.info(`🗄️  缓存大小: ${cacheService.size()} 条记录`);
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
