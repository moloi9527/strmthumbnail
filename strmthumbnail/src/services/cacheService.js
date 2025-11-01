/**
 * 缓存服务模块
 * 管理视频时长等缓存数据
 */

const fs = require('fs').promises;

class CacheService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cache = new Map();
    this.cacheFile = config.get('cacheFile');
    this.autoSaveInterval = config.get('cacheAutoSaveInterval');
    this.autoSaveTimer = null;
    this.isDirty = false; // 标记缓存是否有修改
  }

  /**
   * 初始化缓存
   */
  async init() {
    await this.load();
    this.startAutoSave();
  }

  /**
   * 加载缓存
   */
  async load() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const cacheData = JSON.parse(data);

      Object.entries(cacheData).forEach(([key, value]) => {
        this.cache.set(key, value);
      });

      this.logger.info(`缓存加载成功，共 ${this.cache.size} 条记录`);
      this.isDirty = false;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.logger.info('初始化新缓存');
      } else {
        this.logger.error('加载缓存失败', { error: err.message });
      }
    }
  }

  /**
   * 保存缓存
   */
  async save() {
    if (!this.isDirty) {
      this.logger.debug('缓存无变更，跳过保存');
      return true;
    }

    try {
      const cacheData = Object.fromEntries(this.cache);
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      this.isDirty = false;
      this.logger.debug(`缓存保存成功，共 ${this.cache.size} 条记录`);
      return true;
    } catch (err) {
      this.logger.error('保存缓存失败', { error: err.message });
      return false;
    }
  }

  /**
   * 启动自动保存
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, this.autoSaveInterval);

    this.logger.debug(`自动保存已启动，间隔 ${this.autoSaveInterval}ms`);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      this.logger.debug('自动保存已停止');
    }
  }

  /**
   * 获取缓存
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * 设置缓存
   */
  set(key, value) {
    this.cache.set(key, value);
    this.isDirty = true;
  }

  /**
   * 检查缓存是否存在
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const result = this.cache.delete(key);
    if (result) {
      this.isDirty = true;
    }
    return result;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.isDirty = true;
    this.logger.info('缓存已清空');
  }

  /**
   * 获取缓存大小
   */
  size() {
    return this.cache.size;
  }

  /**
   * 获取所有缓存键
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 清理旧缓存（可选：基于时间戳）
   */
  cleanOldEntries(maxAge = 30 * 24 * 60 * 60 * 1000) { // 默认30天
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp && (now - value.timestamp) > maxAge) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.isDirty = true;
      this.logger.info(`清理了 ${cleaned} 条过期缓存`);
    }

    return cleaned;
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    const types = {};

    entries.forEach(([key]) => {
      const type = key.split(':')[0];
      types[type] = (types[type] || 0) + 1;
    });

    return {
      total: this.cache.size,
      types,
      isDirty: this.isDirty
    };
  }

  /**
   * 关闭缓存服务
   */
  async close() {
    this.stopAutoSave();
    await this.save();
    this.logger.info('缓存服务已关闭');
  }
}

module.exports = CacheService;
