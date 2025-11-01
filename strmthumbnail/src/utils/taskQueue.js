/**
 * 智能任务队列模块
 * 支持并发控制、优先级、任务统计
 */

class TaskQueue {
  constructor(concurrency = 4, logger = null) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.logger = logger;
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0
    };
  }

  /**
   * 添加任务到队列
   */
  async add(task, priority = 0) {
    this.stats.total++;

    // 等待直到有空闲槽位
    while (this.running >= this.concurrency) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.running++;
    this.stats.active = this.running;

    try {
      const result = await task();
      this.stats.completed++;
      return result;
    } catch (error) {
      this.stats.failed++;
      if (this.logger) {
        this.logger.error('任务执行失败', { error: error.message });
      }
      throw error;
    } finally {
      this.running--;
      this.stats.active = this.running;
      this.processNext();
    }
  }

  /**
   * 处理队列中的下一个任务
   */
  processNext() {
    if (this.queue.length > 0 && this.running < this.concurrency) {
      const task = this.queue.shift();
      this.add(task);
    }
  }

  /**
   * 添加任务到等待队列
   */
  enqueue(task, priority = 0) {
    this.queue.push({ task, priority });

    // 按优先级排序（优先级高的在前）
    this.queue.sort((a, b) => b.priority - a.priority);

    this.processNext();
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency,
      stats: { ...this.stats }
    };
  }

  /**
   * 设置并发数
   */
  setConcurrency(concurrency) {
    if (concurrency < 1) {
      throw new Error('并发数必须大于0');
    }

    this.concurrency = concurrency;

    if (this.logger) {
      this.logger.info(`并发数已调整为 ${concurrency}`);
    }

    // 尝试处理更多任务
    while (this.running < this.concurrency && this.queue.length > 0) {
      this.processNext();
    }
  }

  /**
   * 暂停队列
   */
  pause() {
    this.paused = true;
    if (this.logger) {
      this.logger.info('任务队列已暂停');
    }
  }

  /**
   * 恢复队列
   */
  resume() {
    this.paused = false;
    if (this.logger) {
      this.logger.info('任务队列已恢复');
    }
    this.processNext();
  }

  /**
   * 清空队列
   */
  clear() {
    const cleared = this.queue.length;
    this.queue = [];

    if (this.logger) {
      this.logger.info(`已清空队列，移除了 ${cleared} 个任务`);
    }

    return cleared;
  }

  /**
   * 等待所有任务完成
   */
  async drain() {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.logger) {
      this.logger.info('所有任务已完成');
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.total > 0
        ? ((this.stats.completed / this.stats.total) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      active: this.running
    };

    if (this.logger) {
      this.logger.debug('统计信息已重置');
    }
  }
}

module.exports = TaskQueue;
