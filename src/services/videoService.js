/**
 * 视频处理服务模块 - 增强版
 * 使用 fluent-ffmpeg 替代命令行，修复安全问题
 * 添加多截图位置、图片处理等功能
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const validator = require('validator');

class VideoService {
  constructor(config, logger, cacheService) {
    this.config = config;
    this.logger = logger;
    this.cacheService = cacheService;

    this.tmpDir = config.get('tmpDir');
    this.ffprobeTimeout = config.get('ffprobeTimeout');
    this.ffmpegTimeout = config.get('ffmpegTimeout');
    this.httpTimeout = config.get('httpTimeout');

    // 新增配置
    this.thumbnailQuality = config.get('thumbnailQuality') || 85;
    this.thumbnailFormat = config.get('thumbnailFormat') || 'jpg';
    this.maxThumbnailWidth = config.get('maxThumbnailWidth') || 1920;
    this.maxThumbnailHeight = config.get('maxThumbnailHeight') || 1080;
  }

  /**
   * 初始化
   */
  async init() {
    // 确保临时目录存在
    try {
      await fs.mkdir(this.tmpDir, { recursive: true });
      this.logger.info('临时目录已创建', { path: this.tmpDir });
    } catch (err) {
      this.logger.error('创建临时目录失败', { error: err.message });
    }

    // 检查 FFmpeg 是否可用
    try {
      await this.checkFFmpegAvailability();
      this.logger.info('FFmpeg 已就绪');
    } catch (err) {
      this.logger.error('FFmpeg 不可用', { error: err.message });
      throw new Error('FFmpeg 未安装或不可用');
    }
  }

  /**
   * 检查 FFmpeg 可用性
   */
  checkFFmpegAvailability() {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          reject(err);
        } else {
          resolve(formats);
        }
      });
    });
  }

  /**
   * 验证 URL 安全性
   */
  validateUrl(url) {
    // 验证 URL 格式
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true
    })) {
      throw new Error('无效的 URL 格式');
    }

    // 禁止本地地址（防止 SSRF）
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254', // AWS metadata
      '192.168',
      '10.',
      '172.16'
    ];

    for (const pattern of blockedPatterns) {
      if (hostname.includes(pattern)) {
        throw new Error('禁止访问内部网络地址');
      }
    }

    return true;
  }

  /**
   * 验证路径安全性
   */
  validatePath(filePath) {
    // 解析为绝对路径
    const resolvedPath = path.resolve(filePath);

    // 禁止访问系统敏感目录
    const blockedPaths = [
      '/etc',
      '/sys',
      '/proc',
      '/dev',
      '/root',
      '/boot',
      '/usr/bin',
      '/usr/sbin'
    ];

    for (const blocked of blockedPaths) {
      if (resolvedPath.startsWith(blocked)) {
        throw new Error('禁止访问系统目录');
      }
    }

    return resolvedPath;
  }

  /**
   * 获取视频时长（带缓存）- 使用 fluent-ffmpeg
   */
  async getVideoDuration(videoUrl) {
    const cacheKey = `duration:${videoUrl}`;

    // 检查缓存
    if (this.cacheService.has(cacheKey)) {
      this.logger.debug('从缓存获取视频时长', { url: videoUrl });
      return this.cacheService.get(cacheKey);
    }

    // 验证 URL
    this.validateUrl(videoUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('获取视频时长超时'));
      }, this.ffprobeTimeout);

      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        clearTimeout(timeout);

        if (err) {
          this.logger.error('获取视频时长失败', { error: err.message });
          reject(new Error('无法获取视频时长'));
          return;
        }

        const duration = metadata.format.duration;

        if (!duration || isNaN(duration)) {
          reject(new Error('无法解析视频时长'));
          return;
        }

        // 保存到缓存
        this.cacheService.set(cacheKey, duration);
        this.logger.debug('视频时长已缓存', { url: videoUrl, duration });

        resolve(duration);
      });
    });
  }

  /**
   * 生成视频封面 - 使用 fluent-ffmpeg
   * @param {string} videoUrl - 视频 URL
   * @param {string} outputPath - 输出路径
   * @param {number} duration - 视频时长
   * @param {object} options - 选项
   */
  async generateThumbnail(videoUrl, outputPath, duration, options = {}) {
    const {
      position = 'middle', // 'start', 'middle', 'end', 'auto', 或具体秒数
      width = this.maxThumbnailWidth,
      height = this.maxThumbnailHeight,
      quality = this.thumbnailQuality,
      watermark = null
    } = options;

    // 验证输出路径
    const safeOutputPath = this.validatePath(outputPath);

    // 计算截图时间
    let seekTime;
    switch (position) {
      case 'start':
        seekTime = Math.min(5, duration * 0.05); // 5秒或5%
        break;
      case 'middle':
        seekTime = duration / 2;
        break;
      case 'end':
        seekTime = duration * 0.95;
        break;
      case 'auto':
        // 智能选择：跳过前10%和后10%，在中间随机选择
        seekTime = duration * (0.1 + Math.random() * 0.8);
        break;
      default:
        seekTime = typeof position === 'number' ? position : duration / 2;
    }

    this.logger.debug('生成封面', {
      url: videoUrl,
      output: safeOutputPath,
      time: seekTime,
      position
    });

    try {
      // 使用临时文件
      const tempOutput = path.join(this.tmpDir, `temp_${Date.now()}.jpg`);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('生成封面超时'));
        }, this.ffmpegTimeout);

        ffmpeg(videoUrl)
          .seekInput(seekTime)
          .frames(1)
          .size(`${width}x${height}`)
          .outputOptions([
            '-q:v 2', // 高质量
            '-vf scale=\'min(' + width + ',iw)\':\'min(' + height + ',ih)\':force_original_aspect_ratio=decrease'
          ])
          .output(tempOutput)
          .on('end', () => {
            clearTimeout(timeout);
            resolve();
          })
          .on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          })
          .run();
      });

      // 使用 sharp 进行后处理
      let imageProcessor = sharp(tempOutput);

      // 添加水印
      if (watermark && watermark.enabled) {
        // 可以在这里添加水印逻辑
        this.logger.debug('水印功能已预留');
      }

      // 优化和保存
      await imageProcessor
        .jpeg({ quality, mozjpeg: true })
        .toFile(safeOutputPath);

      // 清理临时文件
      await fs.unlink(tempOutput).catch(() => {});

      // 验证封面是否生成成功
      const stats = await fs.stat(safeOutputPath);
      if (stats.size < 1000) {
        throw new Error('生成的封面文件过小，可能损坏');
      }

      this.logger.debug('封面生成成功', {
        output: safeOutputPath,
        size: stats.size
      });

      return {
        success: true,
        path: safeOutputPath,
        size: stats.size
      };
    } catch (err) {
      this.logger.error('封面生成失败', {
        error: err.message,
        output: safeOutputPath
      });
      throw err;
    }
  }

  /**
   * 生成多张封面（预览图）
   */
  async generateMultipleThumbnails(videoUrl, outputDir, duration, count = 4) {
    const thumbnails = [];
    const interval = duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const seekTime = interval * i;
      const outputPath = path.join(outputDir, `preview_${i}.jpg`);

      try {
        const result = await this.generateThumbnail(videoUrl, outputPath, duration, {
          position: seekTime,
          width: 480,
          height: 270,
          quality: 75
        });
        thumbnails.push(result);
      } catch (err) {
        this.logger.warn(`生成预览图 ${i} 失败`, { error: err.message });
      }
    }

    return thumbnails;
  }

  /**
   * 生成 NFO 文件
   */
  async generateNFO(strmFile, videoUrl, thumbName, metadata = {}) {
    const baseName = path.basename(strmFile, '.strm');
    const nfoFile = strmFile.replace('.strm', '.nfo');
    const dateNow = new Date().toISOString().split('T')[0];

    const nfoContent = `<movie>
  <title>${this.escapeXml(metadata.title || baseName)}</title>
  <streamUrl>${this.escapeXml(videoUrl)}</streamUrl>
  <thumb>${this.escapeXml(thumbName)}</thumb>
  <dateadded>${dateNow}</dateadded>
  ${metadata.duration ? `<runtime>${Math.floor(metadata.duration / 60)}</runtime>` : ''}
  ${metadata.description ? `<plot>${this.escapeXml(metadata.description)}</plot>` : ''}
</movie>`;

    try {
      await fs.writeFile(nfoFile, nfoContent);
      this.logger.debug('NFO 文件生成成功', { path: nfoFile });
      return nfoFile;
    } catch (err) {
      this.logger.error('NFO 文件生成失败', {
        error: err.message,
        path: nfoFile
      });
      throw err;
    }
  }

  /**
   * 转义 XML 特殊字符
   */
  escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  /**
   * 检查视频链接可用性
   */
  async checkVideoUrl(videoUrl) {
    try {
      // 验证 URL
      this.validateUrl(videoUrl);

      await axios.head(videoUrl, {
        timeout: this.httpTimeout,
        maxRedirects: 5
      });
      return true;
    } catch (err) {
      this.logger.warn('视频链接无法访问', {
        url: videoUrl,
        error: err.message
      });
      return false;
    }
  }

  /**
   * 处理单个视频文件
   */
  async processVideo(strmFile, config, sendEvent = null) {
    const baseName = path.basename(strmFile, '.strm');
    const dirName = path.dirname(strmFile);

    // 验证路径
    const safeStrmFile = this.validatePath(strmFile);

    const sendLog = (message, level = 'info') => {
      this.logger[level](message, { file: baseName });
      if (sendEvent) {
        sendEvent({ type: 'log', message, level });
      }
    };

    try {
      // 确定封面输出路径
      const outputThumb = config.outputDir
        ? path.join(config.outputDir, `${baseName}.jpg`)
        : path.join(dirName, `${baseName}.jpg`);

      // 检查封面是否已存在
      if (config.coverMode === '1') {
        try {
          await fs.access(outputThumb);
          sendLog(`🟡 已存在封面，跳过：${baseName}`, 'info');
          return { success: true, skipped: true };
        } catch (err) {
          // 文件不存在，继续处理
        }
      }

      // 读取 .strm 文件中的视频链接
      const videoUrl = (await fs.readFile(safeStrmFile, 'utf-8')).trim();

      // 验证视频 URL
      this.validateUrl(videoUrl);

      sendLog(`📹 开始处理：${baseName}`, 'info');

      // 检查链接可用性
      const isAvailable = await this.checkVideoUrl(videoUrl);
      if (!isAvailable) {
        throw new Error('视频链接无法访问');
      }

      // 获取视频时长
      sendLog(`⏱️  获取视频信息...`, 'info');
      const duration = await this.getVideoDuration(videoUrl);

      // 生成封面
      sendLog(`🎨 生成封面...`, 'info');
      const thumbnailPosition = config.thumbnailPosition || 'middle';
      await this.generateThumbnail(videoUrl, outputThumb, duration, {
        position: thumbnailPosition,
        quality: config.thumbnailQuality || this.thumbnailQuality
      });

      // 生成 NFO 文件
      const thumbName = path.basename(outputThumb);
      await this.generateNFO(safeStrmFile, videoUrl, thumbName, { duration });

      sendLog(`📝 已生成 NFO: ${path.basename(safeStrmFile).replace('.strm', '.nfo')}`, 'info');
      sendLog(`✅ 成功：${baseName}`, 'info');

      return { success: true, file: safeStrmFile };
    } catch (error) {
      sendLog(`❌ 失败：${baseName} - ${error.message}`, 'error');
      return { success: false, file: safeStrmFile, error: error.message };
    }
  }

  /**
   * 扫描 .strm 文件 - 使用 fs 递归扫描
   */
  async scanStrmFiles(directory) {
    try {
      // 验证路径
      const safeDirectory = this.validatePath(directory);

      const files = await this.scanDirectory(safeDirectory, '.strm');

      this.logger.info(`扫描到 ${files.length} 个 .strm 文件`, { directory: safeDirectory });

      return files;
    } catch (err) {
      this.logger.error('扫描 .strm 文件失败', {
        error: err.message,
        directory
      });
      throw err;
    }
  }

  /**
   * 递归扫描目录
   */
  async scanDirectory(dir, extension) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 递归扫描子目录
          const subFiles = await this.scanDirectory(fullPath, extension);
          files.push(...subFiles);
        } else if (entry.isFile() && fullPath.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      this.logger.warn('扫描目录失败', { dir, error: err.message });
    }

    return files;
  }

  /**
   * 清理临时目录
   */
  async cleanTempDir() {
    try {
      const files = await fs.readdir(this.tmpDir);
      let cleaned = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.tmpDir, file);
          const stats = await fs.stat(filePath);

          // 删除超过1小时的临时文件
          const fileAge = Date.now() - stats.mtime.getTime();
          if (fileAge > 3600000) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch (err) {
          // 忽略
        }
      }

      if (cleaned > 0) {
        this.logger.info(`清理了 ${cleaned} 个临时文件`);
      }

      return cleaned;
    } catch (err) {
      this.logger.error('清理临时目录失败', { error: err.message });
      return 0;
    }
  }

  /**
   * 获取视频元数据
   */
  async getVideoMetadata(videoUrl) {
    this.validateUrl(videoUrl);

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitRate: metadata.format.bit_rate,
            format: metadata.format.format_name,
            streams: metadata.streams.map(s => ({
              type: s.codec_type,
              codec: s.codec_name,
              width: s.width,
              height: s.height
            }))
          });
        }
      });
    });
  }
}

module.exports = VideoService;
