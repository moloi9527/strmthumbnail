/**
 * 视频处理服务模块
 * 处理视频信息获取、封面生成等
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execPromise = util.promisify(exec);

class VideoService {
  constructor(config, logger, cacheService) {
    this.config = config;
    this.logger = logger;
    this.cacheService = cacheService;

    this.tmpDir = config.get('tmpDir');
    this.ffprobeTimeout = config.get('ffprobeTimeout');
    this.ffmpegTimeout = config.get('ffmpegTimeout');
    this.curlTimeout = config.get('curlTimeout');
    this.httpTimeout = config.get('httpTimeout');
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
  }

  /**
   * 获取视频时长（带缓存）
   */
  async getVideoDuration(videoUrl, baseName) {
    const cacheKey = `duration:${videoUrl}`;

    // 检查缓存
    if (this.cacheService.has(cacheKey)) {
      this.logger.debug('从缓存获取视频时长', { url: videoUrl });
      return this.cacheService.get(cacheKey);
    }

    let duration;
    let tmpVideo = null;

    try {
      // 优化的 ffprobe 命令
      const { stdout } = await execPromise(
        `ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoUrl}"`,
        { timeout: this.ffprobeTimeout }
      );
      duration = parseFloat(stdout.trim());
      this.logger.debug('直接获取视频时长成功', { duration });
    } catch (err) {
      // 如果直接获取失败，尝试下载部分视频
      tmpVideo = path.join(this.tmpDir, `${baseName}_sample.mp4`);

      try {
        this.logger.debug('下载视频样本', { url: videoUrl });

        await execPromise(
          `curl -L --max-time ${Math.floor(this.curlTimeout / 1000)} -r 0-5242879 -o "${tmpVideo}" "${videoUrl}"`,
          { timeout: this.curlTimeout + 5000 }
        );

        const { stdout } = await execPromise(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpVideo}"`
        );
        duration = parseFloat(stdout.trim());

        this.logger.debug('从样本获取视频时长成功', { duration });

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
    this.cacheService.set(cacheKey, duration);
    this.logger.debug('视频时长已缓存', { url: videoUrl, duration });

    return duration;
  }

  /**
   * 生成视频封面
   */
  async generateThumbnail(videoUrl, outputPath, duration) {
    const midTime = duration / 2;

    this.logger.debug('生成封面', {
      url: videoUrl,
      output: outputPath,
      time: midTime
    });

    try {
      await execPromise(
        `ffmpeg -loglevel error -ss ${midTime} -i "${videoUrl}" -vframes 1 -q:v 2 -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" "${outputPath}" -y`,
        { timeout: this.ffmpegTimeout }
      );

      // 验证封面是否生成成功
      const stats = await fs.stat(outputPath);
      if (stats.size < 1000) {
        throw new Error('生成的封面文件过小，可能损坏');
      }

      this.logger.debug('封面生成成功', {
        output: outputPath,
        size: stats.size
      });

      return true;
    } catch (err) {
      this.logger.error('封面生成失败', {
        error: err.message,
        output: outputPath
      });
      throw err;
    }
  }

  /**
   * 生成 NFO 文件
   */
  async generateNFO(strmFile, videoUrl, thumbName) {
    const baseName = path.basename(strmFile, '.strm');
    const nfoFile = strmFile.replace('.strm', '.nfo');
    const dateNow = new Date().toISOString().split('T')[0];

    const nfoContent = `<movie>
  <title>${baseName}</title>
  <streamUrl>${videoUrl}</streamUrl>
  <thumb>${thumbName}</thumb>
  <dateadded>${dateNow}</dateadded>
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
   * 检查视频链接可用性
   */
  async checkVideoUrl(videoUrl) {
    try {
      await axios.head(videoUrl, { timeout: this.httpTimeout });
      return true;
    } catch (err) {
      this.logger.warn('视频链接无法访问', { url: videoUrl });
      return false;
    }
  }

  /**
   * 处理单个视频文件
   */
  async processVideo(strmFile, config, sendEvent = null) {
    const baseName = path.basename(strmFile, '.strm');
    const dirName = path.dirname(strmFile);

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
      const videoUrl = (await fs.readFile(strmFile, 'utf-8')).trim();

      sendLog(`📹 开始处理：${baseName}`, 'info');

      // 检查链接可用性
      const isAvailable = await this.checkVideoUrl(videoUrl);
      if (!isAvailable) {
        throw new Error('视频链接无法访问');
      }

      // 获取视频时长
      const duration = await this.getVideoDuration(videoUrl, baseName);

      // 生成封面
      await this.generateThumbnail(videoUrl, outputThumb, duration);

      // 生成 NFO 文件
      const thumbName = path.basename(outputThumb);
      await this.generateNFO(strmFile, videoUrl, thumbName);

      sendLog(`📝 已生成 NFO: ${path.basename(strmFile).replace('.strm', '.nfo')}`, 'info');
      sendLog(`✅ 成功：${baseName}`, 'info');

      return { success: true, file: strmFile };
    } catch (error) {
      sendLog(`❌ 失败：${baseName} - ${error.message}`, 'error');
      return { success: false, file: strmFile, error: error.message };
    } finally {
      // 清理临时文件
      try {
        const tmpVideo = path.join(this.tmpDir, `${baseName}_sample.mp4`);
        await fs.unlink(tmpVideo);
      } catch (err) {
        // 忽略删除错误
      }
    }
  }

  /**
   * 扫描 .strm 文件
   */
  async scanStrmFiles(directory) {
    try {
      const { stdout } = await execPromise(`find "${directory}" -type f -name "*.strm"`);
      const files = stdout.trim().split('\n').filter(f => f);

      this.logger.info(`扫描到 ${files.length} 个 .strm 文件`, { directory });

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
   * 清理临时目录
   */
  async cleanTempDir() {
    try {
      const files = await fs.readdir(this.tmpDir);
      let cleaned = 0;

      for (const file of files) {
        try {
          await fs.unlink(path.join(this.tmpDir, file));
          cleaned++;
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
}

module.exports = VideoService;
