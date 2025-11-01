/**
 * 错误处理中间件
 */

function createErrorHandler(logger) {
  return function errorHandler(err, req, res, next) {
    logger.error('请求处理错误', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });

    // 不泄露内部错误信息
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
      success: false,
      error: isDevelopment ? err.message : '服务器内部错误',
      ...(isDevelopment && { stack: err.stack })
    });
  };
}

module.exports = createErrorHandler;
