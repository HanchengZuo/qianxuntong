FROM python:3.11

WORKDIR /app

# 安装 LibreOffice（系统依赖）
RUN apt-get update && \
    apt-get install -y libreoffice \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-arphic-uming \
    fonts-arphic-ukai && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 先 copy requirements.txt，提高缓存利用率
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# 再 copy 其余代码
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
