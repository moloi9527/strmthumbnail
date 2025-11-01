/**
 * 视频处理路由
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { validateBody, validateQuery } = require('../middleware/validator');
const TaskQueue = require('../utils/taskQueue');

function createVideoRoutes(videoService, authMiddleware, logger, config) {
  const router = express.Router();

  /**
   * 浏览文件系统
   */
  router.get('/browse',
    authMiddleware,
    validateQuery({
      path: { required: false, type: 'string' }
    }),
    async (req, res) => {
      const targetPath = req.query.path || '/';

      try {
        const items = await fs.readdir(targetPath, { withFileTypes: true });

        const fileList = [];

        // 添加返回上级目录选项
        if (targetPath !== '/') {
          fileList.push({
            name: '..',
            type: 'directory',
            path: path.dirname(targetPath)
          });
        }

        // 添加当前目录的文件和文件夹
        for (const item of items) {
          // 跳过隐藏文件
          if (item.name.startsWith('.')) continue;

          fileList.push({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: path.join(targetPath, item.name)
          });
        }

        // 排序：文件夹在前，按名称排序
        fileList.sort((a, b) => {
          if (a.name === '..') return -1;
          if (b.name === '..') return 1;
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });

        res.json({
          success: true,
          currentPath: targetPath,
          items: fileList
        });
      } catch (error) {
        logger.error('浏览文件系统失败', {
          error: error.message,
          path: targetPath
        });

        res.json({
          success: false,
          error: error.message,
          currentPath: targetPath,
          items: []
        });
      }
    }
  );

  /**
   * 扫描 .strm 文件
   */
  router.post('/scan',
    authMiddleware,
    validateBody({
      strmDir: { required: true, type: 'string' }
    }),
    async (req, res) => {
      const { strmDir } = req.body;

      try {
        const files = await videoService.scanStrmFiles(strmDir);

        res.json({
          success: true,
          files: files,
          count: files.length
        });
      } catch (error) {
        logger.error('扫描文件失败', { error: error.message });

        res.json({
          success: false,
          error: error.message,
          files: []
        });
      }
    }
  );

  /**
   * 处理视频 - 使用 SSE 流式传输进度
   */
  router.post('/process',
    authMiddleware,
    validateBody({
      files: { required: true, type: 'object' },
      config: { required: true, type: 'object' }
    }),
    async (req, res) => {
      const { files, config: processConfig } = req.body;

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const progress = {
        total: files.length,
        processed: 0,
        success: 0,
        failed: 0
      };

      const failedFiles = [];

      // 智能并发控制
      let concurrency = parseInt(processConfig.concurrency) || config.get('defaultConcurrency');
      if (files.length < 10) {
        concurrency = Math.min(concurrency, config.get('minConcurrency'));
      } else if (files.length > 100) {
        concurrency = Math.min(concurrency * 1.5, config.get('maxConcurrency'));
      }

      const taskQueue = new TaskQueue(Math.floor(concurrency), logger);

      sendEvent({
        type: 'log',
        message: `🚀 使用 ${Math.floor(concurrency)} 个并发线程处理 ${files.length} 个文件`,
        level: 'info'
      });

      // 创建任务
      const tasks = files.map(file => async () => {
        const result = await videoService.processVideo(file, processConfig, sendEvent);

        if (result.success) {
          if (!result.skipped) {
            progress.success++;
          }
        } else {
          progress.failed++;
          failedFiles.push(file);
          sendEvent({
            type: 'failed',
            file: file
          });
        }

        progress.processed++;
        sendEvent({ type: 'progress', progress: { ...progress } });
      });

      // 并发执行所有任务
      await Promise.all(tasks.map(task => taskQueue.add(task)));

      // 发送完成消息
      sendEvent({
        type: 'complete',
        progress,
        failedFiles: failedFiles
      });

      res.end();
    }
  );

  /**
   * 健康检查
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

module.exports = createVideoRoutes;
