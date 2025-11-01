/**
 * 日志系统模块
 * 支持多级别日志、文件输出、格式化
 */

const fs = require('fs').promises;
const path = require('path');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const LOG_COLORS = {
  error: '\x1b[31m', // 红色
  warn: '\x1b[33m',  // 黄色
  info: '\x1b[36m',  // 青色
  debug: '\x1b[90m', // 灰色
  reset: '\x1b[0m'
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.logFile = options.logFile;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB

    // 确保日志目录存在
    if (this.logFile && this.enableFile) {
      this.ensureLogDir();
    }
  }

  /**
   * 确保日志目录存在
   */
  async ensureLogDir() {
    try {
      const dir = path.dirname(this.logFile);
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error('创建日志目录失败:', err.message);
    }
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * 检查日志级别是否应该输出
   */
  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  /**
   * 写入日志到文件
   */
  async writeToFile(message) {
    if (!this.logFile || !this.enableFile) return;

    try {
      // 检查文件大小，如果超过限制则轮转
      try {
        const stats = await fs.stat(this.logFile);
        if (stats.size > this.maxFileSize) {
          await this.rotateLogFile();
        }
      } catch (err) {
        // 文件不存在，继续
      }

      await fs.appendFile(this.logFile, message + '\n');
    } catch (err) {
      console.error('写入日志文件失败:', err.message);
    }
  }

  /**
   * 轮转日志文件
   */
  async rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const rotatedFile = this.logFile.replace(/\.log$/, `-${timestamp}.log`);
      await fs.rename(this.logFile, rotatedFile);
    } catch (err) {
      console.error('轮转日志文件失败:', err.message);
    }
  }

  /**
   * 输出日志到控制台
   */
  logToConsole(level, message) {
    if (!this.enableConsole) return;

    const color = LOG_COLORS[level] || '';
    const reset = LOG_COLORS.reset;
    console.log(`${color}${message}${reset}`);
  }

  /**
   * 通用日志方法
   */
  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    // 输出到控制台
    this.logToConsole(level, formattedMessage);

    // 写入文件
    await this.writeToFile(formattedMessage);
  }

  /**
   * 错误日志
   */
  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  /**
   * 警告日志
   */
  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  /**
   * 信息日志
   */
  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  /**
   * 调试日志
   */
  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  /**
   * 记录请求
   */
  request(req) {
    const message = `${req.method} ${req.url}`;
    const meta = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    return this.info(message, meta);
  }

  /**
   * 记录响应
   */
  response(req, res, duration) {
    const message = `${req.method} ${req.url} ${res.statusCode}`;
    const meta = {
      duration: `${duration}ms`
    };
    return this.info(message, meta);
  }
}

module.exports = Logger;
