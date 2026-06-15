# ============ 基础镜像 ============
FROM python:3.11-slim AS base

WORKDIR /app

# 安装系统依赖（cryptography 编译需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============ 运行阶段 ============
FROM base AS runtime

# 复制应用代码
COPY . .

# 创建数据目录（SQLite 持久化挂载点）
RUN mkdir -p /app/data

# 非 root 用户运行
RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
