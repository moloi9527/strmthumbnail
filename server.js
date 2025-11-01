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

// 确保临时目录存在
async function ensureTmpDir() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (err) {
    console.error('创建临时目录失败:', err);
  }
}

ensureTmpDir();

// ============================================================
// API 路由
// ============================================================

/**
 * 测试 Emby 连接
 */
app.post('/api/test-emby', requireAuth, async (req, res) => {
  const { embyUrl, embyApiKey } = req.body;

  try {
    const response = await axios.get(`${embyUrl}/System/Info?api_key=${embyApiKey}`, {
      timeout: 5000
    });

    res.json({
      success: true,
      serverName: response.data.ServerName,
      version: response.data.Version
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

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
 * 处理视频 - 使用 SSE 流式传输进度
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

  // 并发处理
  const concurrency = parseInt(config.concurrency) || 4;
  const chunks = [];
  for (let i = 0; i < files.length; i += concurrency) {
    chunks.push(files.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(file => processVideo(file, config, progress, sendEvent, failedFiles)));
  }

  // 发送完成消息和失败文件列表
  sendEvent({ 
    type: 'complete', 
    progress,
    failedFiles: failedFiles
  });
  
  res.end();
});

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

    // 检查链接可用性
    try {
      await axios.head(videoUrl, { timeout: 10000 });
    } catch (err) {
      throw new Error('视频链接无法访问');
    }

    // 获取视频时长
    let duration;
    let tmpVideo = null;
    try {
      const { stdout } = await execPromise(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoUrl}"`,
        { timeout: 15000 }
      );
      duration = parseFloat(stdout.trim());
    } catch (err) {
      // 如果直接获取失败，尝试下载部分视频
      tmpVideo = path.join(TMP_DIR, `${baseName}_sample.mp4`);
      try {
        await execPromise(`curl -L --max-time 30 -o "${tmpVideo}" "${videoUrl}" --range 0-5242880`);
        
        const { stdout } = await execPromise(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpVideo}"`
        );
        duration = parseFloat(stdout.trim());
      } catch (curlErr) {
        throw new Error('无法下载视频样本');
      }
    }

    if (!duration || isNaN(duration)) {
      throw new Error('无法获取视频时长');
    }

    // 截取中间帧
    const midTime = duration / 2;
    await execPromise(
      `ffmpeg -loglevel error -ss ${midTime} -noaccurate_seek -i "${videoUrl}" -frames:v 1 -q:v 2 "${outputThumb}" -y`,
      { timeout: 30000 }
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

    // 上传到 Emby
    await uploadToEmby(outputThumb, baseName, config);

    sendEvent({ 
      type: 'log', 
      message: `✅ 成功：${baseName}`,
      level: 'success'
    });

    progress.processed++;
    progress.success++;

    // 清理临时文件
    if (tmpVideo) {
      try {
        await fs.unlink(tmpVideo);
      } catch (err) {
        // 忽略删除错误
      }
    }

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

    // 清理临时文件
    try {
      const tmpVideo = path.join(TMP_DIR, `${baseName}_sample.mp4`);
      await fs.unlink(tmpVideo);
    } catch (err) {
      // 忽略删除错误
    }
  }

  sendEvent({ type: 'progress', progress: { ...progress } });
}

/**
 * 上传封面到 Emby
 */
async function uploadToEmby(thumbPath, baseName, config) {
  try {
    // 查找项目 ID
    const searchResponse = await axios.get(
      `${config.embyUrl}/Items?api_key=${config.embyApiKey}`,
      { timeout: 5000 }
    );

    const item = searchResponse.data.Items.find(i => i.Name === baseName);
    if (!item) {
      console.log(`未在 Emby 中找到项目：${baseName}`);
      return;
    }

    // 上传封面
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', await fs.readFile(thumbPath), {
      filename: path.basename(thumbPath),
      contentType: 'image/jpeg'
    });

    await axios.post(
      `${config.embyUrl}/Items/${item.Id}/Images/Primary?api_key=${config.embyApiKey}`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 10000
      }
    );

    console.log(`☁️ 已上传到 Emby: ${baseName}`);
  } catch (error) {
    console.error(`Emby 上传失败: ${baseName} - ${error.message}`);
  }
}

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
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 正在关闭服务器...');
  process.exit(0);
});