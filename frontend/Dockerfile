# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 构建参数：生产环境 API 地址（空字符串 = 相对路径，由宿主机 Nginx 代理）
ARG VITE_API_BASE=""
ENV VITE_API_BASE=${VITE_API_BASE}

# 先复制依赖文件，利用 Docker 缓存
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# 复制源码并构建
COPY . .
RUN npm run build

# ============ 运行阶段 ============
FROM node:20-alpine AS runtime

WORKDIR /app

# 安装轻量静态服务器
RUN npm install -g serve@14

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# --single 启用 SPA 模式：所有路径 fallback 到 index.html
CMD ["serve", "dist", "--single", "--listen", "0.0.0.0:3000"]
