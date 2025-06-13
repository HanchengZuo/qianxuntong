FROM python:3.11-bullseye

WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y libreoffice \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-arphic-uming \
    fonts-arphic-ukai && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip -i http://mirrors.tencentyun.com/pypi/simple --trusted-host mirrors.tencentyun.com && \
    pip install -r requirements.txt -i http://mirrors.tencentyun.com/pypi/simple --trusted-host mirrors.tencentyun.com

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
