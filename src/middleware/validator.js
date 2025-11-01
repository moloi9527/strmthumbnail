/**
 * 请求验证中间件
 */

/**
 * 验证请求体
 */
function validateBody(schema) {
  return function (req, res, next) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // 必填验证
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} 是必填字段`);
        continue;
      }

      // 如果字段不是必填且为空，跳过其他验证
      if (!rules.required && !value) {
        continue;
      }

      // 类型验证
      if (rules.type) {
        const actualType = typeof value;
        if (actualType !== rules.type) {
          errors.push(`${field} 必须是 ${rules.type} 类型`);
        }
      }

      // 最小长度验证
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} 长度不能少于 ${rules.minLength}`);
      }

      // 最大长度验证
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} 长度不能超过 ${rules.maxLength}`);
      }

      // 最小值验证
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} 不能小于 ${rules.min}`);
      }

      // 最大值验证
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} 不能大于 ${rules.max}`);
      }

      // 正则验证
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} 格式不正确`);
      }

      // 自定义验证
      if (rules.custom && !rules.custom(value)) {
        errors.push(`${field} 验证失败`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '请求参数验证失败',
        errors
      });
    }

    next();
  };
}

/**
 * 验证查询参数
 */
function validateQuery(schema) {
  return function (req, res, next) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field];

      if (rules.required && !value) {
        errors.push(`查询参数 ${field} 是必填的`);
      }

      if (rules.type === 'number' && value && isNaN(Number(value))) {
        errors.push(`查询参数 ${field} 必须是数字`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '查询参数验证失败',
        errors
      });
    }

    next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};
