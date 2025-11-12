/**
 * 路径验证和安全检查工具
 * 防止路径遍历攻击
 */

const path = require('path');
const fs = require('fs').promises;

class PathValidator {
  constructor(logger) {
    this.logger = logger;

    // 系统敏感目录列表
    this.blockedPaths = [
      '/etc',
      '/sys',
      '/proc',
      '/dev',
      '/root',
      '/boot',
      '/usr/bin',
      '/usr/sbin',
      '/var/run',
      '/var/lib'
    ];

    // Windows 系统目录
    if (process.platform === 'win32') {
      this.blockedPaths.push(
        'C:\\Windows',
        'C:\\Program Files',
        'C:\\Program Files (x86)'
      );
    }
  }

  /**
   * 验证路径安全性
   * @param {string} inputPath - 待验证的路径
   * @param {object} options - 验证选项
   * @returns {string} 安全的绝对路径
   */
  validatePath(inputPath, options = {}) {
    const {
      mustExist = false,
      mustBeDirectory = false,
      mustBeFile = false,
      allowedBasePath = null
    } = options;

    // 1. 解析为绝对路径
    const resolvedPath = path.resolve(inputPath);

    // 2. 检查路径遍历
    if (this.hasPathTraversal(inputPath)) {
      throw new Error('检测到路径遍历攻击');
    }

    // 3. 检查是否访问系统敏感目录
    for (const blocked of this.blockedPaths) {
      if (resolvedPath.startsWith(blocked)) {
        this.logger && this.logger.warn('尝试访问系统目录', { path: resolvedPath });
        throw new Error('禁止访问系统目录');
      }
    }

    // 4. 检查基础路径限制
    if (allowedBasePath) {
      const resolvedBasePath = path.resolve(allowedBasePath);
      if (!resolvedPath.startsWith(resolvedBasePath)) {
        throw new Error('路径超出允许范围');
      }
    }

    return resolvedPath;
  }

  /**
   * 检测路径遍历模式
   */
  hasPathTraversal(inputPath) {
    const dangerous = [
      '../',
      '..\\',
      '%2e%2e/',
      '%2e%2e\\',
      '..%2f',
      '..%5c'
    ];

    const lowerPath = inputPath.toLowerCase();
    return dangerous.some(pattern => lowerPath.includes(pattern));
  }

  /**
   * 验证文件存在性和类型
   */
  async validatePathExists(resolvedPath, options = {}) {
    const { mustBeDirectory = false, mustBeFile = false } = options;

    try {
      const stats = await fs.stat(resolvedPath);

      if (mustBeDirectory && !stats.isDirectory()) {
        throw new Error('路径必须是目录');
      }

      if (mustBeFile && !stats.isFile()) {
        throw new Error('路径必须是文件');
      }

      return stats;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('路径不存在');
      }
      throw err;
    }
  }

  /**
   * 安全地连接路径
   */
  safejoin(basePath, ...segments) {
    // 验证基础路径
    const safeBasePath = this.validatePath(basePath);

    // 连接路径
    const joined = path.join(safeBasePath, ...segments);

    // 验证结果路径仍在基础路径下
    const resolvedJoined = path.resolve(joined);
    if (!resolvedJoined.startsWith(safeBasePath)) {
      throw new Error('路径遍历检测失败');
    }

    return resolvedJoined;
  }

  /**
   * 获取安全的相对路径
   */
  safeRelative(from, to) {
    const safeFrom = this.validatePath(from);
    const safeTo = this.validatePath(to);

    return path.relative(safeFrom, safeTo);
  }
}

module.exports = PathValidator;
