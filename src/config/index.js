/**
 * 配置管理模块
 * 支持环境变量和配置文件
 */

const path = require('path');
const fs = require('fs').promises;

class Config {
  constructor() {
    this.config = {
      // 服务器配置
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',

      // 认证配置
      defaultUsername: process.env.DEFAULT_USERNAME || 'admin',
      defaultPassword: process.env.DEFAULT_PASSWORD || 'emby123456',
      sessionExpiry: parseInt(process.env.SESSION_EXPIRY || '86400000'), // 24小时

      // 处理配置
      tmpDir: process.env.TMP_DIR || '/tmp/emby_thumb_temp',
      cacheFile: process.env.CACHE_FILE || path.join(process.cwd(), '.video_cache.json'),
      authConfigFile: process.env.AUTH_CONFIG_FILE || path.join(process.cwd(), 'auth.json'),

      // 并发配置
      defaultConcurrency: parseInt(process.env.DEFAULT_CONCURRENCY || '4'),
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '8'),
      minConcurrency: parseInt(process.env.MIN_CONCURRENCY || '2'),

      // 缓存配置
      cacheAutoSaveInterval: parseInt(process.env.CACHE_SAVE_INTERVAL || '300000'), // 5分钟
      cacheMaxAge: parseInt(process.env.CACHE_MAX_AGE || '2592000000'), // 30天

      // 超时配置（毫秒）
      ffprobeTimeout: parseInt(process.env.FFPROBE_TIMEOUT || '10000'),
      ffmpegTimeout: parseInt(process.env.FFMPEG_TIMEOUT || '30000'),
      curlTimeout: parseInt(process.env.CURL_TIMEOUT || '20000'),
      httpTimeout: parseInt(process.env.HTTP_TIMEOUT || '8000'),

      // 缩略图配置
      thumbnailQuality: parseInt(process.env.THUMBNAIL_QUALITY || '85'),
      thumbnailFormat: process.env.THUMBNAIL_FORMAT || 'jpg',
      maxThumbnailWidth: parseInt(process.env.MAX_THUMBNAIL_WIDTH || '1920'),
      maxThumbnailHeight: parseInt(process.env.MAX_THUMBNAIL_HEIGHT || '1080'),
      defaultThumbnailPosition: process.env.DEFAULT_THUMBNAIL_POSITION || 'middle', // start, middle, end, auto

      // 日志配置
      logLevel: process.env.LOG_LEVEL || 'info',
      logFile: process.env.LOG_FILE || path.join(process.cwd(), 'logs', 'app.log'),
      logMaxSize: process.env.LOG_MAX_SIZE || '10m',
      logMaxFiles: process.env.LOG_MAX_FILES || '7d',

      // 安全配置
      enableCors: process.env.ENABLE_CORS !== 'false',
      enableHelmet: process.env.ENABLE_HELMET !== 'false',
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15分钟
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),

      // 环境
      env: process.env.NODE_ENV || 'production'
    };
  }

  /**
   * 从文件加载配置
   */
  async loadFromFile(configPath) {
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const fileConfig = JSON.parse(data);
      this.config = { ...this.config, ...fileConfig };
      return true;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('加载配置文件失败:', err.message);
      }
      return false;
    }
  }

  /**
   * 保存配置到文件
   */
  async saveToFile(configPath) {
    try {
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (err) {
      console.error('保存配置文件失败:', err.message);
      return false;
    }
  }

  /**
   * 获取配置项
   */
  get(key) {
    return this.config[key];
  }

  /**
   * 设置配置项
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 验证配置
   */
  validate() {
    const errors = [];

    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('端口号必须在 1-65535 之间');
    }

    if (this.config.sessionExpiry < 60000) {
      errors.push('会话过期时间不能少于 1 分钟');
    }

    if (this.config.defaultConcurrency < 1 || this.config.defaultConcurrency > this.config.maxConcurrency) {
      errors.push('并发数配置无效');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例
const config = new Config();

module.exports = config;
