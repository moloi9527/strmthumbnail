/**
 * 认证路由
 */

const express = require('express');
const { validateBody } = require('../middleware/validator');

function createAuthRoutes(authService, authMiddleware) {
  const router = express.Router();

  /**
   * 登录
   */
  router.post('/login',
    validateBody({
      username: { required: true, type: 'string', minLength: 3 },
      password: { required: true, type: 'string', minLength: 6 }
    }),
    async (req, res) => {
      const { username, password } = req.body;
      const result = await authService.login(username, password);

      if (result.success) {
        res.json(result);
      } else {
        res.status(401).json(result);
      }
    }
  );

  /**
   * 登出
   */
  router.post('/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const result = authService.logout(token);
    res.json(result);
  });

  /**
   * 验证会话
   */
  router.get('/verify', authMiddleware, (req, res) => {
    res.json({
      success: true,
      username: req.user.username
    });
  });

  /**
   * 修改密码
   */
  router.post('/change-password',
    authMiddleware,
    validateBody({
      oldPassword: { required: true, type: 'string', minLength: 6 },
      newPassword: { required: true, type: 'string', minLength: 6 }
    }),
    async (req, res) => {
      const { oldPassword, newPassword } = req.body;
      const result = await authService.changePassword(oldPassword, newPassword);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    }
  );

  return router;
}

module.exports = createAuthRoutes;
