const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');
const crypto = require('crypto');

const execPromise = util.promisify(exec);
const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 会话存储（生产环境建议使用 Redis）
const sessions = new Map();

// 配置文件路径
const AUTH_CONFIG_FILE = path.join(__dirname, 'auth.json');

// 默认账号密码（首次运行会创建）
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'emby123456'; // 请修改此默认密码！

// 初始化认证配置
async function initAuthConfig() {
  try {
    await fs.access(AUTH_CONFIG_FILE);
    console.log('✅ 认证配置文件已存在');
  } catch (err) {
    // 文件不存在，创建默认配置
    const passwordHash = crypto.createHash('sha256').update(DEFAULT_PASSWORD).digest('hex');
    const config = {
      username: DEFAULT_USERNAME,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    };
    await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 已创建默认账号：');
    console.log(`   用户名: ${DEFAULT_USERNAME}`);
    console.log(`   密码: ${DEFAULT_PASSWORD}`);
    console.log('   ⚠️  请立即修改默认密码！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// 读取认证配置
async function getAuthConfig() {
  const data = await fs.readFile(AUTH_CONFIG_FILE, 'utf-8');
  return JSON.parse(data);
}

// 生成会话 token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 验证中间件
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: '未授权访问' });
  }

  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ success: false, error: '会话已过期' });
  }

  // 刷新会话过期时间
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时
  next();
}

// 托管前端文件（无需认证）
app.use(express.static('public'));

// ============================================================
// 认证相关 API
// ============================================================

/**
 * 登录
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const config = await getAuthConfig();
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (username === config.username && passwordHash === config.passwordHash) {
      const token = generateToken();
      sessions.set(token, {
        username: username,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
      });

      res.json({
        success: true,
        token: token,
        username: username,
        message: '登录成功'
      });
    } else {
      res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '登录失败: ' + error.message
    });
  }
});

/**
 * 登出
 */
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    sessions.delete(token);
  }
  res.json({ success: true, message: '已登出' });
});

/**
 * 验证会话
 */
app.get('/api/auth/verify', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  res.json({
    success: true,
    username: session.username
  });
});

/**
 * 修改密码
 */
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const config = await getAuthConfig();
    const oldPasswordHash = crypto.createHash('sha256').update(oldPassword).digest('hex');

    if (oldPasswordHash !== config.passwordHash) {
      return res.status(400).json({
        success: false,
        error: '原密码错误'
      });
    }

    const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    config.passwordHash = newPasswordHash;
    config.updatedAt = new Date().toISOString();

    await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));

    // 清除所有会话，强制重新登录
    sessions.clear();

    res.json({
      success: true,
      message: '密码修改成功，请重新登录'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '修改密码失败: ' + error.message
    });
  }
});

// 临时目录
const TMP_DIR = '/tmp/emby_thumb_temp';
const LOG_FILE = '/tmp/emby_thumb.log';
const CACHE_FILE = path.join(__dirname, '.video_cache.json');

// 缓存管理
const videoCache = new Map();

// 加载缓存
async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const cacheData = JSON.parse(data);
    Object.entries(cacheData).forEach(([key, value]) => {
      videoCache.set(key, value);
    });
    console.log(`✅ 已加载缓存，共 ${videoCache.size} 条记录`);
  } catch (err) {
    console.log('📝 初始化新缓存');
  }
}

// 保存缓存
async function saveCache() {
  try {
    const cacheData = Object.fromEntries(videoCache);
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (err) {
    console.error('保存缓存失败:', err);
  }
}

// 定期保存缓存（每5分钟）
setInterval(saveCache, 5 * 60 * 1000);

// 确保临时目录存在
async function ensureTmpDir() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (err) {
    console.error('创建临时目录失败:', err);
  }
}

// 初始化
async function init() {
  await ensureTmpDir();
  await loadCache();
}

init();

// ============================================================
// API 路由
// ============================================================

// Emby 功能已移除

/**
 * 浏览文件系统
 */
app.get('/api/browse', requireAuth, async (req, res) => {
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
    res.json({
      success: false,
      error: error.message,
      currentPath: targetPath,
      items: []
    });
  }
});

/**
 * 扫描 .strm 文件
 */
app.post('/api/scan', requireAuth, async (req, res) => {
  const { strmDir } = req.body;

  try {
    const { stdout } = await execPromise(`find "${strmDir}" -type f -name "*.strm"`);
    const files = stdout.trim().split('\n').filter(f => f);

    res.json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      files: []
    });
  }
});

/**
 * 智能任务队列类
 */
class TaskQueue {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    while (this.running >= this.concurrency) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.processNext();
    }
  }

  processNext() {
    if (this.queue.length > 0 && this.running < this.concurrency) {
      const task = this.queue.shift();
      this.add(task);
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency
    };
  }
}

/**
 * 处理视频 - 使用 SSE 流式传输进度 + 智能任务队列
 */
app.post('/api/process', requireAuth, async (req, res) => {
  const { files, config } = req.body;

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

  // 智能并发控制：根据文件数量动态调整
  let concurrency = parseInt(config.concurrency) || 4;
  if (files.length < 10) {
    concurrency = Math.min(concurrency, 2); // 少量文件使用较少并发
  } else if (files.length > 100) {
    concurrency = Math.min(concurrency * 1.5, 8); // 大量文件可适当增加并发
  }

  const taskQueue = new TaskQueue(Math.floor(concurrency));

  sendEvent({
    type: 'log',
    message: `🚀 使用 ${Math.floor(concurrency)} 个并发线程处理 ${files.length} 个文件`,
    level: 'info'
  });

  // 将所有任务添加到队列
  const tasks = files.map(file => () => processVideo(file, config, progress, sendEvent, failedFiles));

  // 并发执行所有任务
  await Promise.all(tasks.map(task => taskQueue.add(task)));

  // 发送完成消息和失败文件列表
  sendEvent({
    type: 'complete',
    progress,
    failedFiles: failedFiles
  });

  res.end();
});

/**
 * 获取视频时长（带缓存）
 */
async function getVideoDuration(videoUrl, baseName) {
  const cacheKey = `duration:${videoUrl}`;

  // 检查缓存
  if (videoCache.has(cacheKey)) {
    return videoCache.get(cacheKey);
  }

  let duration;
  let tmpVideo = null;

  try {
    // 优化的 ffprobe 命令，减少超时时间
    const { stdout } = await execPromise(
      `ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoUrl}"`,
      { timeout: 10000 }
    );
    duration = parseFloat(stdout.trim());
  } catch (err) {
    // 如果直接获取失败，尝试下载部分视频（仅前5MB）
    tmpVideo = path.join(TMP_DIR, `${baseName}_sample.mp4`);
    try {
      await execPromise(`curl -L --max-time 20 -r 0-5242879 -o "${tmpVideo}" "${videoUrl}"`, { timeout: 25000 });

      const { stdout } = await execPromise(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpVideo}"`
      );
      duration = parseFloat(stdout.trim());

      // 清理临时文件
      await fs.unlink(tmpVideo).catch(() => {});
    } catch (curlErr) {
      if (tmpVideo) {
        await fs.unlink(tmpVideo).catch(() => {});
      }
      throw new Error('无法下载视频样本');
    }
  }

  if (!duration || isNaN(duration)) {
    throw new Error('无法获取视频时长');
  }

  // 保存到缓存
  videoCache.set(cacheKey, duration);
  return duration;
}

/**
 * 处理单个视频文件
 */
async function processVideo(strmFile, config, progress, sendEvent, failedFiles) {
  const baseName = path.basename(strmFile, '.strm');
  const dirName = path.dirname(strmFile);

  try {
    // 确定封面输出路径
    const outputThumb = config.outputDir
      ? path.join(config.outputDir, `${baseName}.jpg`)
      : path.join(dirName, `${baseName}.jpg`);

    // 检查封面是否已存在
    if (config.coverMode === '1') {
      try {
        await fs.access(outputThumb);
        sendEvent({
          type: 'log',
          message: `🟡 已存在封面，跳过：${baseName}`,
          level: 'info'
        });
        progress.processed++;
        progress.success++;
        sendEvent({ type: 'progress', progress: { ...progress } });
        return;
      } catch (err) {
        // 文件不存在，继续处理
      }
    }

    // 读取 .strm 文件中的视频链接
    const videoUrl = (await fs.readFile(strmFile, 'utf-8')).trim();

    sendEvent({
      type: 'log',
      message: `📹 开始处理：${baseName}`,
      level: 'info'
    });

    // 检查链接可用性（使用 HEAD 请求，超时缩短）
    try {
      await axios.head(videoUrl, { timeout: 8000 });
    } catch (err) {
      throw new Error('视频链接无法访问');
    }

    // 获取视频时长（使用缓存）
    const duration = await getVideoDuration(videoUrl, baseName);

    // 截取中间帧（优化参数）
    const midTime = duration / 2;
    await execPromise(
      `ffmpeg -loglevel error -ss ${midTime} -i "${videoUrl}" -vframes 1 -q:v 2 -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" "${outputThumb}" -y`,
      { timeout: 25000 }
    );

    // 验证封面是否生成成功
    const stats = await fs.stat(outputThumb);
    if (stats.size < 1000) {
      throw new Error('生成的封面文件过小，可能损坏');
    }

    // 生成 NFO 文件
    const nfoFile = strmFile.replace('.strm', '.nfo');
    const dateNow = new Date().toISOString().split('T')[0];
    const thumbName = path.basename(outputThumb);

    const nfoContent = `<movie>
  <title>${baseName}</title>
  <streamUrl>${videoUrl}</streamUrl>
  <thumb>${thumbName}</thumb>
  <dateadded>${dateNow}</dateadded>
</movie>`;

    await fs.writeFile(nfoFile, nfoContent);

    sendEvent({
      type: 'log',
      message: `📝 已生成 NFO: ${path.basename(nfoFile)}`,
      level: 'info'
    });

    sendEvent({
      type: 'log',
      message: `✅ 成功：${baseName}`,
      level: 'success'
    });

    progress.processed++;
    progress.success++;

  } catch (error) {
    sendEvent({
      type: 'log',
      message: `❌ 失败：${baseName} - ${error.message}`,
      level: 'error'
    });

    // 记录失败的文件
    sendEvent({
      type: 'failed',
      file: strmFile
    });

    if (failedFiles) {
      failedFiles.push(strmFile);
    }

    progress.processed++;
    progress.failed++;
  } finally {
    // 清理临时文件（在 finally 中确保一定执行）
    try {
      const tmpVideo = path.join(TMP_DIR, `${baseName}_sample.mp4`);
      await fs.unlink(tmpVideo);
    } catch (err) {
      // 忽略删除错误
    }
  }

  sendEvent({ type: 'progress', progress: { ...progress } });
}

// uploadToEmby 函数已移除

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// 启动服务器
// ============================================================

initAuthConfig().then(() => {
  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Emby 封面管理器后端服务已启动`);
    console.log(`📡 监听端口: ${PORT}`);
    console.log(`🌐 API 地址: http://localhost:${PORT}/api`);
    console.log(`📁 前端地址: http://localhost:${PORT}`);
    console.log(`🔐 认证已启用`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n👋 正在关闭服务器...');
  console.log('💾 保存缓存中...');
  await saveCache();
  console.log('✅ 缓存已保存');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 正在关闭服务器...');
  console.log('💾 保存缓存中...');
  await saveCache();
  console.log('✅ 缓存已保存');
  process.exit(0);
});