/**
 * 认证中间件
 */

function createAuthMiddleware(authService, logger) {
  return function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    const result = authService.verifySession(token);

    if (!result.valid) {
      logger.warn('未授权访问', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    // 将用户信息附加到请求对象
    req.user = {
      username: result.username
    };

    next();
  };
}

module.exports = createAuthMiddleware;
