#!/bin/bash
# entrypoint.sh

# 确保 migration 文件夹已存在（第一次可以不用）
if [ ! -d "migrations" ]; then
  flask db init
fi

# 自动升级数据库到最新结构（幂等，不会重复升级）
flask db upgrade

# 启动应用
exec python app.py
