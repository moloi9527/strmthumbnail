/**
 * 认证服务模块 - 增强版
 * 使用 bcrypt 替代 SHA-256
 * 添加登录失败限制、会话持久化等安全功能
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs').promises;

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟

class AuthService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.loginAttempts = new Map(); // 登录失败记录
    this.authConfigFile = config.get('authConfigFile');
    this.sessionExpiry = config.get('sessionExpiry');
  }

  /**
   * 初始化认证配置
   */
  async init() {
    try {
      await fs.access(this.authConfigFile);
      this.logger.info('认证配置文件已存在');

      // 检查是否需要迁移旧密码
      await this.migrateOldPassword();
    } catch (err) {
      // 文件不存在，创建默认配置
      const defaultUsername = this.config.get('defaultUsername');
      const defaultPassword = this.config.get('defaultPassword');

      this.logger.info('创建默认账号...');
      const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

      const config = {
        username: defaultUsername,
        passwordHash: passwordHash,
        hashAlgorithm: 'bcrypt',
        createdAt: new Date().toISOString(),
        version: 2
      };

      await fs.writeFile(this.authConfigFile, JSON.stringify(config, null, 2));

      this.logger.warn('已创建默认账号，请立即修改密码', {
        username: defaultUsername
      });
    }
  }

  /**
   * 迁移旧密码（从 SHA-256 迁移到 bcrypt）
   */
  async migrateOldPassword() {
    try {
      const config = await this.getAuthConfig();

      // 检查是否是旧版本的 SHA-256
      if (!config.hashAlgorithm || config.hashAlgorithm === 'sha256') {
        this.logger.warn('检测到旧版密码哈希，建议重置密码');
        // 保留旧哈希，但标记需要更新
        config.needsPasswordUpdate = true;
        config.version = 1;
        await this.saveAuthConfig(config);
      }
    } catch (err) {
      this.logger.error('密码迁移检查失败', { error: err.message });
    }
  }

  /**
   * 读取认证配置
   */
  async getAuthConfig() {
    try {
      const data = await fs.readFile(this.authConfigFile, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      this.logger.error('读取认证配置失败', { error: err.message });
      throw new Error('读取认证配置失败');
    }
  }

  /**
   * 保存认证配置
   */
  async saveAuthConfig(config) {
    try {
      await fs.writeFile(this.authConfigFile, JSON.stringify(config, null, 2));
      return true;
    } catch (err) {
      this.logger.error('保存认证配置失败', { error: err.message });
      return false;
    }
  }

  /**
   * 生成会话 token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 检查登录失败次数
   */
  checkLoginAttempts(username) {
    const attempts = this.loginAttempts.get(username);

    if (!attempts) {
      return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }

    // 检查锁定是否过期
    if (Date.now() > attempts.lockedUntil) {
      this.loginAttempts.delete(username);
      return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }

    // 检查是否被锁定
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
      return {
        allowed: false,
        lockedUntil: attempts.lockedUntil,
        remainingTime: remainingTime
      };
    }

    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count
    };
  }

  /**
   * 记录登录失败
   */
  recordLoginFailure(username) {
    const attempts = this.loginAttempts.get(username) || { count: 0 };

    attempts.count++;
    attempts.lastAttempt = Date.now();

    // 如果达到最大尝试次数，锁定账号
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
      this.logger.warn('账号已被锁定', {
        username,
        duration: LOCKOUT_DURATION / 1000 / 60 + '分钟'
      });
    }

    this.loginAttempts.set(username, attempts);
  }

  /**
   * 清除登录失败记录
   */
  clearLoginAttempts(username) {
    this.loginAttempts.delete(username);
  }

  /**
   * 用户登录
   */
  async login(username, password, metadata = {}) {
    try {
      // 检查登录尝试次数
      const attemptCheck = this.checkLoginAttempts(username);

      if (!attemptCheck.allowed) {
        return {
          success: false,
          error: `账号已被锁定，请在 ${attemptCheck.remainingTime} 分钟后重试`
        };
      }

      const config = await this.getAuthConfig();

      // 验证用户名
      if (username !== config.username) {
        this.recordLoginFailure(username);
        this.logger.warn('登录失败：用户名错误', { username });
        return {
          success: false,
          error: '用户名或密码错误',
          remainingAttempts: attemptCheck.remainingAttempts - 1
        };
      }

      // 验证密码
      let isPasswordValid = false;

      if (config.hashAlgorithm === 'bcrypt' || config.version === 2) {
        // 使用 bcrypt 验证
        isPasswordValid = await bcrypt.compare(password, config.passwordHash);
      } else {
        // 兼容旧版 SHA-256（建议用户更新密码）
        const crypto = require('crypto');
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        isPasswordValid = sha256Hash === config.passwordHash;

        if (isPasswordValid && config.needsPasswordUpdate) {
          this.logger.info('检测到旧密码格式，建议用户更新密码');
        }
      }

      if (isPasswordValid) {
        // 清除登录失败记录
        this.clearLoginAttempts(username);

        // 生成会话
        const token = this.generateToken();
        this.sessions.set(token, {
          username: username,
          expiresAt: Date.now() + this.sessionExpiry,
          createdAt: Date.now(),
          metadata: {
            ip: metadata.ip,
            userAgent: metadata.userAgent
          }
        });

        this.logger.info('用户登录成功', {
          username,
          ip: metadata.ip
        });

        return {
          success: true,
          token: token,
          username: username,
          message: '登录成功',
          needsPasswordUpdate: config.needsPasswordUpdate || false
        };
      } else {
        this.recordLoginFailure(username);
        this.logger.warn('登录失败：密码错误', {
          username,
          remainingAttempts: attemptCheck.remainingAttempts - 1
        });

        return {
          success: false,
          error: '用户名或密码错误',
          remainingAttempts: attemptCheck.remainingAttempts - 1
        };
      }
    } catch (error) {
      this.logger.error('登录失败', { error: error.message });
      return {
        success: false,
        error: '登录失败: ' + error.message
      };
    }
  }

  /**
   * 用户登出
   */
  logout(token) {
    if (token && this.sessions.has(token)) {
      const session = this.sessions.get(token);
      this.sessions.delete(token);
      this.logger.info('用户登出', { username: session.username });
    }
    return { success: true, message: '已登出' };
  }

  /**
   * 验证会话
   */
  verifySession(token) {
    if (!token || !this.sessions.has(token)) {
      return { valid: false, error: '未授权访问' };
    }

    const session = this.sessions.get(token);
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, error: '会话已过期' };
    }

    // 刷新会话过期时间
    session.expiresAt = Date.now() + this.sessionExpiry;
    session.lastActivity = Date.now();

    return {
      valid: true,
      username: session.username,
      metadata: session.metadata
    };
  }

  /**
   * 修改密码
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const config = await this.getAuthConfig();

      // 验证旧密码
      let isOldPasswordValid = false;

      if (config.hashAlgorithm === 'bcrypt' || config.version === 2) {
        isOldPasswordValid = await bcrypt.compare(oldPassword, config.passwordHash);
      } else {
        // 兼容旧版 SHA-256
        const crypto = require('crypto');
        const sha256Hash = crypto.createHash('sha256').update(oldPassword).digest('hex');
        isOldPasswordValid = sha256Hash === config.passwordHash;
      }

      if (!isOldPasswordValid) {
        return {
          success: false,
          error: '原密码错误'
        };
      }

      // 验证新密码强度
      const passwordStrength = this.checkPasswordStrength(newPassword);
      if (!passwordStrength.isStrong) {
        return {
          success: false,
          error: '密码强度不足: ' + passwordStrength.reason
        };
      }

      // 生成新密码哈希
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      config.passwordHash = newPasswordHash;
      config.hashAlgorithm = 'bcrypt';
      config.version = 2;
      config.updatedAt = new Date().toISOString();
      delete config.needsPasswordUpdate;

      await this.saveAuthConfig(config);

      // 清除所有会话，强制重新登录
      this.sessions.clear();

      this.logger.info('密码修改成功');

      return {
        success: true,
        message: '密码修改成功，请重新登录'
      };
    } catch (error) {
      this.logger.error('修改密码失败', { error: error.message });
      return {
        success: false,
        error: '修改密码失败: ' + error.message
      };
    }
  }

  /**
   * 检查密码强度
   */
  checkPasswordStrength(password) {
    if (password.length < 8) {
      return { isStrong: false, reason: '密码长度至少8个字符' };
    }

    if (password.length < 12) {
      // 12字符以下需要满足复杂度要求
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);

      const complexityCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

      if (complexityCount < 3) {
        return {
          isStrong: false,
          reason: '密码需要包含大写字母、小写字母、数字、特殊字符中的至少3种'
        };
      }
    }

    return { isStrong: true };
  }

  /**
   * 清理过期会话
   */
  cleanExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        cleaned++;
      }
    }

    // 清理过期的登录失败记录
    for (const [username, attempts] of this.loginAttempts.entries()) {
      if (now > attempts.lockedUntil && attempts.count >= MAX_LOGIN_ATTEMPTS) {
        this.loginAttempts.delete(username);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`清理了 ${cleaned} 个过期会话`);
    }

    return cleaned;
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    const now = Date.now();
    return {
      total: this.sessions.size,
      active: Array.from(this.sessions.values()).filter(
        s => now <= s.expiresAt
      ).length,
      lockedAccounts: Array.from(this.loginAttempts.values()).filter(
        a => a.count >= MAX_LOGIN_ATTEMPTS && now < a.lockedUntil
      ).length
    };
  }

  /**
   * 获取所有活跃会话（管理功能）
   */
  getActiveSessions() {
    const now = Date.now();
    const sessions = [];

    for (const [token, session] of this.sessions.entries()) {
      if (now <= session.expiresAt) {
        sessions.push({
          token: token.substring(0, 8) + '...', // 部分隐藏
          username: session.username,
          createdAt: new Date(session.createdAt).toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
          lastActivity: session.lastActivity ? new Date(session.lastActivity).toISOString() : null,
          metadata: session.metadata
        });
      }
    }

    return sessions;
  }

  /**
   * 强制登出所有会话
   */
  logoutAll() {
    const count = this.sessions.size;
    this.sessions.clear();
    this.logger.info(`强制登出所有会话: ${count} 个`);
    return { success: true, count };
  }
}

module.exports = AuthService;
