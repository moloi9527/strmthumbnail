#!/bin/bash
echo "🚀 启动 Emby 封面管理器..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未安装 Node.js"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动服务
if command -v pm2 &> /dev/null; then
    echo "使用 PM2 启动..."
    pm2 start server.js --name emby-thumbnail
    pm2 save
    echo "✅ 服务已启动！"
    echo "📱 访问地址: http://localhost:3000"
    pm2 logs emby-thumbnail
else
    echo "使用 Node.js 直接启动..."
    node server.js
fi
EOF
