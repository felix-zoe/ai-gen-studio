#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AI Gen Studio — 一键部署脚本
# 用法: chmod +x deploy.sh && ./deploy.sh
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ---------- 前置检查 ----------
command -v docker >/dev/null 2>&1 || error "未安装 Docker，请先安装: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || error "未安装 Docker Compose V2 插件"

# ---------- 环境变量 ----------
if [ ! -f .env ]; then
    warn "未找到 .env，从模板创建..."
    cp .env.example .env

    # 自动生成 SECRET_KEY
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null \
                 || openssl rand -hex 32)
    sed -i "s/^SECRET_KEY=$/SECRET_KEY=${SECRET_KEY}/" .env
    info "已生成 SECRET_KEY"

    # 自动生成 MASTER_ENCRYPTION_KEY
    MASTER_KEY=$(python3 -c "import base64, os; print(base64.b64encode(os.urandom(32)).decode())" 2>/dev/null \
                 || openssl rand -base64 32)
    sed -i "s/^MASTER_ENCRYPTION_KEY=$/MASTER_ENCRYPTION_KEY=${MASTER_KEY}/" .env
    info "已生成 MASTER_ENCRYPTION_KEY"

    warn "请编辑 .env 填入 COS 配置和域名:"
    echo "    nano .env"
    echo ""
    echo "必填项:"
    echo "  DOMAIN           — 你的域名 (如 example.com)"
    echo "  COS_SECRET_ID    — 腾讯云 COS SecretId"
    echo "  COS_SECRET_KEY   — 腾讯云 COS SecretKey"
    echo "  COS_REGION       — COS 地域 (如 ap-shanghai)"
    echo "  COS_BUCKET       — COS 桶名"
    echo ""
    echo "填写完成后重新运行此脚本: ./deploy.sh"
    exit 0
fi

# 检查必填项
source .env
[ -z "${DOMAIN:-}" ]           && error ".env 中 DOMAIN 未设置"
[ -z "${SECRET_KEY:-}" ]       && error ".env 中 SECRET_KEY 未设置"
[ -z "${MASTER_ENCRYPTION_KEY:-}" ] && error ".env 中 MASTER_ENCRYPTION_KEY 未设置"
[ -z "${COS_SECRET_ID:-}" ]    && error ".env 中 COS_SECRET_ID 未设置"
[ -z "${COS_SECRET_KEY:-}" ]   && error ".env 中 COS_SECRET_KEY 未设置"

info "环境变量检查通过"

# ---------- 构建 & 启动 ----------
info "构建 Docker 镜像..."
docker compose build

info "启动容器..."
docker compose up -d

# ---------- 状态检查 ----------
sleep 3
info "容器状态:"
docker compose ps

echo ""
info "部署完成！"
echo ""
echo "  前端: http://127.0.0.1:3000"
echo "  后端: http://127.0.0.1:8000"
echo ""
echo "请确保宿主机 Nginx 已配置反向代理（参考 nginx-host.conf）:"
echo "  /      → http://127.0.0.1:3000"
echo "  /api/  → http://127.0.0.1:8000"
