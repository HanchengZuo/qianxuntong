# 使用官方 Python 镜像作为基础镜像
FROM python:3.11-bullseye

# 设置构建参数：是否使用国内镜像（默认使用）
ARG USE_MIRROR=true

# 设置工作目录
WORKDIR /app

# 国内镜像加速，依赖安装
RUN if [ "$USE_MIRROR" = "true" ]; then \
    sed -i 's|http://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org|https://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list ; \
    fi && \
    apt-get update && \
    apt-get install -y --fix-missing \
    libreoffice \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-arphic-uming \
    fonts-arphic-ukai \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-eng \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 时区设置（可选）
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 拷贝 Python 依赖清单
COPY requirements.txt ./

# 安装 pip 依赖，根据 USE_MIRROR 切换 pip 源（清华 PyPI 镜像）
RUN if [ "$USE_MIRROR" = "true" ]; then \
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install --upgrade pip && \
    pip install -r requirements.txt ; \
    else \
    pip install --upgrade pip && \
    pip install -r requirements.txt ; \
    fi

# 拷贝宋体字体
COPY static/fonts/simsun.ttc /usr/share/fonts/windows/simsun.ttc

# 拷贝所有字体文件（包括子目录），到容器的系统字体目录
COPY static/fonts/ /usr/share/fonts/custom/

# 刷新字体缓存
RUN fc-cache -fv

# 拷贝项目文件
COPY . .

# 拷贝启动脚本并授权
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 设置容器启动端口
EXPOSE 5000

# 启动命令
CMD ["/entrypoint.sh"]
