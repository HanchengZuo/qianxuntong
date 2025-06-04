# create_db.py
from app import app, db

# 导入模型（如果模型定义在models.py）
# from models import *

with app.app_context():
    db.create_all()
    print("数据库和数据表已创建成功！")
