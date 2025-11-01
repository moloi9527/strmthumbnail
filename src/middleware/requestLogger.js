/**
 * 请求日志中间件
 */

function createRequestLogger(logger) {
  return function requestLogger(req, res, next) {
    const start = Date.now();

    // 记录请求
    logger.request(req);

    // 监听响应结束
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.response(req, res, duration);
    });

    next();
  };
}

module.exports = createRequestLogger;
