# 使用官方 Python 镜像作为基础镜像
FROM python:3.11-bullseye

# 设置构建参数：是否使用国内镜像（默认使用）
ARG USE_MIRROR=true

# 设置工作目录
WORKDIR /app

# 替换 apt 源为清华源（国内最快最全），USE_MIRROR 控制是否替换
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
    fonts-arphic-ukai && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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
