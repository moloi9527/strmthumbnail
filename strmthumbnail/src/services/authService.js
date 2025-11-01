/**
 * 认证服务模块
 * 处理用户认证、会话管理
 */

const crypto = require('crypto');
const fs = require('fs').promises;

class AuthService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
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
    } catch (err) {
      // 文件不存在，创建默认配置
      const defaultUsername = this.config.get('defaultUsername');
      const defaultPassword = this.config.get('defaultPassword');
      const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');

      const config = {
        username: defaultUsername,
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      };

      await fs.writeFile(this.authConfigFile, JSON.stringify(config, null, 2));

      this.logger.warn('已创建默认账号，请立即修改密码', {
        username: defaultUsername,
        password: defaultPassword
      });
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
   * 用户登录
   */
  async login(username, password) {
    try {
      const config = await this.getAuthConfig();
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

      if (username === config.username && passwordHash === config.passwordHash) {
        const token = this.generateToken();
        this.sessions.set(token, {
          username: username,
          expiresAt: Date.now() + this.sessionExpiry
        });

        this.logger.info('用户登录成功', { username });

        return {
          success: true,
          token: token,
          username: username,
          message: '登录成功'
        };
      } else {
        this.logger.warn('登录失败：用户名或密码错误', { username });
        return {
          success: false,
          error: '用户名或密码错误'
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
    if (token) {
      this.sessions.delete(token);
      this.logger.info('用户登出');
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

    return {
      valid: true,
      username: session.username
    };
  }

  /**
   * 修改密码
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const config = await this.getAuthConfig();
      const oldPasswordHash = crypto.createHash('sha256').update(oldPassword).digest('hex');

      if (oldPasswordHash !== config.passwordHash) {
        return {
          success: false,
          error: '原密码错误'
        };
      }

      const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
      config.passwordHash = newPasswordHash;
      config.updatedAt = new Date().toISOString();

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

    if (cleaned > 0) {
      this.logger.debug(`清理了 ${cleaned} 个过期会话`);
    }

    return cleaned;
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    return {
      total: this.sessions.size,
      active: Array.from(this.sessions.values()).filter(
        s => Date.now() <= s.expiresAt
      ).length
    };
  }
}

module.exports = AuthService;
