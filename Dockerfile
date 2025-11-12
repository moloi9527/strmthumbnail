# 多阶段构建 Dockerfile
FROM node:18-alpine AS base

# 安装 FFmpeg 和其他依赖
RUN apk add --no-cache \
    ffmpeg \
    curl \
    && rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 生产阶段
FROM base AS production

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p /app/logs /app/tmp /app/data

# 设置权限
RUN chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "server.js"]

# 开发阶段
FROM base AS development

# 安装所有依赖（包括 devDependencies）
RUN npm install && npm cache clean --force

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p /app/logs /app/tmp /app/data

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
