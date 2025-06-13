FROM python:3.11

WORKDIR /app

# 替换 apt 源为阿里云镜像，加速安装 LibreOffice 及字体
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y libreoffice \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-arphic-uming \
    fonts-arphic-ukai && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 提前安装依赖（提高构建缓存利用）
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# 拷贝项目文件
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
