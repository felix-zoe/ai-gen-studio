# AI Gen Studio

AI 图片与视频生成网页应用。支持 SenseNova 文生图、Agnes 文生图/图生图、Agnes 文生视频/图生视频。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query |
| 后端 | FastAPI + SQLAlchemy + Alembic + SQLite |
| 认证 | JWT (OAuth2PasswordBearer) + bcrypt |
| 加密 | AES-256-GCM（用户 API Key 加密存储） |
| 存储 | 腾讯云 COS（生成结果转存） |

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 20+
- npm

### 本地开发

```bash
git clone <repo-url> ai-gen-studio
cd ai-gen-studio

# 后端
cp backend/.env.example backend/.env
# 编辑 backend/.env，填写 MASTER_ENCRYPTION_KEY（32字节 base64 编码）

cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API 文档自动生成于 [http://localhost:8000/docs](http://localhost:8000/docs)

```bash
# 前端
cd frontend
cp ../frontend/.env.example .env
npm install
npm run dev
```

访问 [http://localhost:5173](http://localhost:5173)

### 生产部署（Docker）

适用于已配置好 Nginx + SSL 的服务器，容器仅绑定 `127.0.0.1`，由宿主机 Nginx 反代。

```bash
# 1. 配置环境变量
cp .env.example .env
nano .env   # 填写域名、SECRET_KEY、MASTER_ENCRYPTION_KEY、COS 等

# 2. 构建并启动
docker compose up -d --build

# 3. 配置宿主机 Nginx（参考 nginx-host.conf）
# 将 / 反代到 127.0.0.1:3000，/api/ 反代到 127.0.0.1:8000
nginx -t && nginx -s reload
```

部署后访问 `https://你的域名` 即可使用。

## 目录结构

```
ai-gen-studio/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app 入口
│   │   ├── core/                  # 配置、安全、加密工具
│   │   ├── db/                    # 数据库引擎、Session、Base
│   │   ├── models/                # SQLAlchemy 数据模型
│   │   ├── schemas/               # Pydantic 请求/响应模型
│   │   ├── api/                   # API 路由
│   │   └── services/              # 业务逻辑层
│   ├── alembic/                   # 数据库迁移
│   ├── Dockerfile                 # 后端容器构建
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/            # UI 组件
│   │   ├── pages/                 # 页面
│   │   ├── providers/             # React Context 提供者
│   │   ├── lib/                   # 工具函数、API 客户端
│   │   └── types/                 # TypeScript 类型
│   ├── Dockerfile                 # 前端容器构建（多阶段）
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── docker-compose.yml             # 容器编排（生产部署）
├── nginx-host.conf                # 宿主机 Nginx 配置参考
├── .env.example                   # 生产环境变量模板
└── README.md
```

## 功能路线

- [x] 用户注册/登录（JWT）
- [x] BYOK：用户自管 API Key（AES-256-GCM 加密）
- [x] SenseNova 文生图
- [x] Agnes 文生图 / 图生图
- [x] Agnes 文生视频 / 图生视频（异步 + 轮询）
- [x] 生成历史记录（详情弹窗、批量删除）
- [x] 腾讯云 COS 转存
- [x] Docker Compose 生产部署

## 环境变量

### 后端 (`backend/.env`)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 | `sqlite:///./app.db` |
| `SECRET_KEY` | JWT 签名密钥 | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT 过期时间(分) | `1440` |
| `MASTER_ENCRYPTION_KEY` | AES-256-GCM 主密钥(32B base64) | — |
| `CORS_ORIGINS` | 允许的前端源 | `["http://localhost:5173"]` |
| `COS_SECRET_ID` | 腾讯云 COS SecretId | — |
| `COS_SECRET_KEY` | 腾讯云 COS SecretKey | — |
| `COS_REGION` | COS 地域 | — |
| `COS_BUCKET` | COS 桶名 | — |

### 前端 (`frontend/.env`)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE` | 后端 API 地址 | `http://localhost:8000` |

### 生产部署（根目录 `.env`）

| 变量 | 说明 | 必填 |
|------|------|------|
| `DOMAIN` | 域名（用于 CORS，不含协议） | 是 |
| `SECRET_KEY` | JWT 签名密钥（deploy.sh 自动生成） | 是 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT 过期时间(分) | 否，默认 `1440` |
| `MASTER_ENCRYPTION_KEY` | AES-256-GCM 主密钥（deploy.sh 自动生成） | 是 |
| `COS_SECRET_ID` | 腾讯云 COS SecretId | 是 |
| `COS_SECRET_KEY` | 腾讯云 COS SecretKey | 是 |
| `COS_REGION` | COS 地域 | 是 |
| `COS_BUCKET` | COS 桶名 | 是 |

## 上游 API

- **SenseNova** — 文生图（同步）
- **Agnes Image** — 文生图、图生图（同步）
- **Agnes Video** — 文生视频、图生视频（异步，需轮询）

用户在设置页自行配置 API Key 后使用。

## 安全

- 密码使用 **bcrypt** 哈希存储
- API Key 使用 **AES-256-GCM** 加密入库，主密钥来自环境变量
- API Key 前端**掩码显示**（`sk-****1234`），绝不回传明文
- 所有上游 API 调用由后端代理发起，前端不直接暴露第三方密钥
