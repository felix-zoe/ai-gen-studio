# AI Gen Studio — CLAUDE.md

## 项目概述
AI 图片/视频生成网页应用，前后端分离。

- 前端：React + Vite + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query
- 后端：FastAPI (Python 3.11+) + Uvicorn + httpx
- 数据库：SQLite + SQLAlchemy/SQLModel + Alembic
- 认证：JWT (OAuth2PasswordBearer)
- 对象存储：腾讯云 COS

## 目录结构约定

```
ai-gen-studio/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app 入口
│   │   ├── config.py        # 配置 & 环境变量
│   │   ├── database.py      # DB 连接 & session
│   │   ├── models/          # SQLModel 数据模型
│   │   ├── schemas/         # Pydantic 请求/响应 schema
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑层
│   │   ├── middleware/      # 中间件
│   │   └── utils/           # 工具函数 (加密等)
│   ├── alembic/             # 数据库迁移
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # 通用组件
│   │   ├── pages/           # 页面
│   │   ├── hooks/           # 自定义 hooks
│   │   ├── services/        # API 调用
│   │   ├── lib/             # 工具函数
│   │   └── types/           # TypeScript 类型
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── .env.example
└── CLAUDE.md
```

## 开发约定

1. **先给方案**：回答时先给出方案和要改/新建的文件清单，等确认后再写代码。
2. **不硬编码密钥**：所有密钥、API Key、Secret 从环境变量或加密数据库读取。
3. **维护 .env.example**：每次新增环境变量时同步更新。
4. **API Key 安全**：
   - 入库时 AES-256-GCM 加密，主密钥在 `MASTER_ENCRYPTION_KEY` 环境变量
   - 前端始终掩码显示（`sk-****...****ab`），绝不回传明文
5. **所有上游 API 调用**在后端用 httpx 异步发起，前端不直接调用。
6. **测试后清理**：自己启动的测试服务（Uvicorn、Vite 等）在验证完成后必须关掉，不允许留进程在后台。
7. **结果存储**：从上游 API 下载结果后转存腾讯云 COS，数据库只存 COS key。

## 上游 API

- **SenseNova 文生图**（同步）：POST `https://token.sensenova.cn/v1/images/generations`
- **Agnes 文生图/图生图**（同步）：POST `https://apihub.agnes-ai.com/v1/images/generations`
- **Agnes 视频**（异步）：POST `https://apihub.agnes-ai.com/v1/videos` → 轮询 GET（详见 memory/api-contracts.md）

## 环境变量

| 变量名 | 说明 |
|--------|------|
| DATABASE_URL | SQLite 连接字符串 |
| SECRET_KEY | JWT 签名密钥 |
| ALGORITHM | JWT 算法 (HS256) |
| ACCESS_TOKEN_EXPIRE_MINUTES | JWT 过期时间 |
| MASTER_ENCRYPTION_KEY | AES-256-GCM 主密钥 |
| COS_SECRET_ID | 腾讯云 COS SecretId |
| COS_SECRET_KEY | 腾讯云 COS SecretKey |
| COS_REGION | COS 地域 |
| COS_BUCKET | COS 桶名 |
