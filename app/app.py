from flask import (
    Flask,
    request,
    render_template,
    redirect,
    url_for,
    jsonify,
)
import os
from werkzeug.utils import secure_filename
from sqlalchemy import and_
from utils.signer import insert_signatures_into_pdf
import uuid
import json
import base64
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Text
from datetime import datetime
from pytz import timezone
from urllib.parse import quote
from flask_login import UserMixin
from flask_login import (
    LoginManager,
    login_user,
    logout_user,
    login_required,
    current_user,
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = "very-secret-key-123456"
app.config["UPLOAD_FOLDER"] = "static/uploads"
app.config["FINAL_FOLDER"] = "static/final"
app.config["SIGN_URL"] = "http://127.0.0.1:5000/sign/"

# 让 Flask 支持通过环境变量读取数据库连接
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "mysql+pymysql://root:qxt123456@db:3306/qianxuntong?charset=utf8mb4"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["FINAL_FOLDER"], exist_ok=True)

# 定义中国时区
CHINA_TZ = timezone("Asia/Shanghai")


class SignatureTask(db.Model):
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    task_id = db.Column(db.String(64), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(CHINA_TZ))
    is_completed = db.Column(db.Boolean, default=False)
    employee_ids = db.Column(Text, default="[]")  # ✅ 新增字段（存为 JSON 字符串）
    quiz_required = db.Column(db.Boolean, default=False)

    def get_employee_ids(self):
        try:
            return json.loads(self.employee_ids)
        except:
            return []


class SignatureStatus(db.Model):
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    task_id = db.Column(
        db.String(64), db.ForeignKey("signature_task.task_id"), nullable=False
    )
    employee_id = db.Column(db.Integer, db.ForeignKey("employee.id"), nullable=False)
    signed = db.Column(db.Boolean, default=False)
    signed_at = db.Column(db.DateTime)
    quiz_passed = db.Column(db.Boolean, default=False)


class Employee(db.Model):
    __table_args__ = (
        db.UniqueConstraint("user_id", "local_id"),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    id = db.Column(db.Integer, primary_key=True)  # 物理主键
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    local_id = db.Column(db.Integer, nullable=False)  # 用户空间自增逻辑id
    name = db.Column(db.String(50), nullable=False)


class QuizQuestion(db.Model):
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    task_id = db.Column(
        db.String(64), db.ForeignKey("signature_task.task_id"), nullable=False
    )
    content = db.Column(db.Text, nullable=False)  # 题干内容
    options = db.Column(
        db.Text, nullable=False
    )  # JSON 字符串，例如：["选项A", "选项B", "选项C"]
    correct_answers = db.Column(
        db.Text, nullable=False
    )  # JSON 字符串，例如：[0] 或 [0, 2] 表示正确答案下标
    multiple = db.Column(db.Boolean, default=False)  # 是否为多选题


class User(UserMixin, db.Model):
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)


# 签名区域表
class SignatureBox(db.Model):
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(
        db.String(64), db.ForeignKey("signature_task.task_id"), nullable=False
    )
    employee_id = db.Column(db.Integer, db.ForeignKey("employee.id"), nullable=False)
    page = db.Column(db.Integer, nullable=False)
    left = db.Column(db.Float, nullable=False)
    top = db.Column(db.Float, nullable=False)
    width = db.Column(db.Float, nullable=False)
    height = db.Column(db.Float, nullable=False)
    signed = db.Column(db.Boolean, default=False)
    image = db.Column(db.Text)  # base64字符串，签名前可为空
    preview_width = db.Column(db.Float)
    preview_height = db.Column(db.Float)


class TrainingMaterial(db.Model):
    __tablename__ = "training_material"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class TrainingQuestion(db.Model):
    __tablename__ = "training_question"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    material_id = db.Column(
        db.Integer, db.ForeignKey("training_material.id"), nullable=False
    )
    content = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, nullable=False)  # JSON: ["A", "B", ...]
    correct_answers = db.Column(db.Text, nullable=False)  # JSON: [0,2]
    multiple = db.Column(db.Boolean, default=False)


class TrainingTask(db.Model):
    __tablename__ = "training_task"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    material_id = db.Column(db.Integer, db.ForeignKey("training_material.id"))
    description = db.Column(db.Text)
    deadline = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.now)
    max_attempts = db.Column(db.Integer, default=1)  # 最大答题次数
    pass_score_ratio = db.Column(db.Float, default=0.8)  # 通过所需正确率（如0.8=80%）


class TrainingTaskEmployee(db.Model):
    __tablename__ = "training_task_employee"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("training_task.id"))
    employee_id = db.Column(db.Integer, db.ForeignKey("employee.id"))
    status = db.Column(db.String(10), default="未完成")
    score = db.Column(db.Float)
    submit_time = db.Column(db.DateTime)
    attempts = db.Column(db.Integer, default=0)  # 已答题次数
    is_passed = db.Column(db.Boolean, default=False)  # 是否已通过


class TrainingAnswerHistory(db.Model):
    __tablename__ = "training_answer_history"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("training_task.id"))
    employee_id = db.Column(db.Integer, db.ForeignKey("employee.id"))
    attempt_num = db.Column(db.Integer)  # 第几次答题
    score = db.Column(db.Float)
    is_passed = db.Column(db.Boolean)
    submit_time = db.Column(db.DateTime, default=datetime.now)


def parse_answers(answer_str):
    mapping = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5}
    answer_str = answer_str.upper().replace(" ", "")
    return [mapping[c] for c in answer_str.split(",") if c in mapping]


login_manager = LoginManager(app)
login_manager.login_view = "login"


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        if User.query.filter_by(username=username).first():
            return render_template("register.html", error="用户名已存在")
        user = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        # 注册成功，重定向到登录页面，并带参数
        return redirect(url_for("login", msg="注册成功，请登录"))
    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    # 优先从GET参数获取提示信息
    msg = request.args.get("msg")
    error = None
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for("index"))
        error = "用户名或密码错误"
    return render_template("login.html", error=error, msg=msg)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


@app.route("/", methods=["GET", "POST"])
@login_required
def index():
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        pdf_file = request.files.get("pdf")
        employee_ids = request.form.getlist("employee_ids")  # ✅ 获取选中的员工 ID 列表
        quiz_required = bool(request.form.get("quiz_required"))

        if not title or not pdf_file or not pdf_file.filename.endswith(".pdf"):
            return "请上传 PDF 文件并填写标题", 400

        if not employee_ids:
            return "请至少选择一个员工", 400

        filename = secure_filename(pdf_file.filename)
        task_id = str(uuid.uuid4())
        user_folder = os.path.join(app.config["UPLOAD_FOLDER"], str(current_user.id))
        os.makedirs(user_folder, exist_ok=True)
        save_path = os.path.join(user_folder, f"{task_id}_{filename}")
        pdf_file.save(save_path)

        # ✅ 创建签名任务记录
        task = SignatureTask(
            user_id=current_user.id,
            task_id=task_id,
            title=title,
            employee_ids=json.dumps(employee_ids),
            quiz_required=quiz_required,  # ✅ 添加字段
        )
        db.session.add(task)
        db.session.commit()

        # ✅ 将选中的员工 ID 保存到 SignatureStatus 表中，签名状态暂设为 False
        for emp_id in employee_ids:
            status = SignatureStatus(
                user_id=current_user.id,
                task_id=task_id,
                employee_id=int(emp_id),
                signed=False,
            )
            db.session.add(status)

        db.session.commit()

        # ✅ 解析题库内容
        quiz_items = []
        i = 0
        while True:
            content = request.form.get(f"questions[{i}][content]")
            if not content:
                break
            # 用 getlist 获取所有选项
            options = request.form.getlist(f"questions[{i}][options][]")
            # 单选题只会有一组答案
            answer = request.form.get(f"questions[{i}][answers]")
            # 这里你可能还要处理 answers 是字符串还是数字（取决于你的前端 input value）
            try:
                correct_answers = [int(answer)] if answer is not None else []
            except Exception:
                correct_answers = []

            quiz = QuizQuestion(
                user_id=current_user.id,
                task_id=task_id,
                content=content,
                options=json.dumps(options, ensure_ascii=False),
                correct_answers=json.dumps(correct_answers),
            )
            db.session.add(quiz)
            i += 1

        db.session.commit()

        return redirect(url_for("preview", task_id=task_id))

    # ✅ 获取签名任务及进度信息
    tasks = (
        SignatureTask.query.filter_by(user_id=current_user.id)
        .order_by(SignatureTask.created_at.desc())
        .all()
    )
    task_info = []

    for task in tasks:
        statuses = SignatureStatus.query.filter_by(
            user_id=current_user.id, task_id=task.task_id
        ).all()
        signed_count = sum(1 for s in statuses if s.signed)
        total_count = len(statuses)
        task_info.append(
            {
                "id": task.id,
                "task_id": task.task_id,
                "title": task.title,
                "created_at": task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "progress": f"{signed_count}/{total_count}",
                "is_completed": task.is_completed,
            }
        )

    employees = (
        Employee.query.filter_by(user_id=current_user.id)
        .order_by(Employee.local_id.desc())
        .all()
    )
    materials = (
        TrainingMaterial.query.filter_by(user_id=current_user.id)
        .order_by(TrainingMaterial.created_at.desc())
        .all()
    )
    return render_template(
        "index.html", tasks=task_info, employees=employees, materials=materials
    )


@app.route("/employee/new", methods=["POST"])
@login_required
def add_employee():
    name = request.form["name"]
    # 查找该用户下已有员工最大local_id
    max_local = (
        db.session.query(db.func.max(Employee.local_id))
        .filter_by(user_id=current_user.id)
        .scalar()
    )
    next_local_id = 1 if max_local is None else max_local + 1

    new_emp = Employee(name=name, user_id=current_user.id, local_id=next_local_id)
    db.session.add(new_emp)
    db.session.commit()
    return jsonify({"status": "success", "id": new_emp.local_id, "name": new_emp.name})


@app.route("/employee/delete/<int:local_id>", methods=["POST"])
@login_required
def delete_employee(local_id):
    emp = Employee.query.filter_by(user_id=current_user.id, local_id=local_id).first()
    if emp:
        db.session.delete(emp)
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "not_found"}), 404


@app.route("/preview/<task_id>")
@login_required
def preview(task_id):

    boxes = SignatureBox.query.filter_by(task_id=task_id).all()
    sign_ready = len(boxes) > 0
    sign_link = app.config["SIGN_URL"] + task_id if sign_ready else None

    employees_raw = Employee.query.filter_by(user_id=current_user.id).all()
    employees = [
        {
            "local_id": emp.local_id,
            "name": emp.name,
        }
        for emp in employees_raw
    ]

    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()

    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], str(current_user.id))
    uploaded_filename = next(
        (f for f in os.listdir(user_folder) if f.startswith(task_id)),
        None,
    )

    if not uploaded_filename:
        return "未找到上传的 PDF 文件", 404

    encoded_filename = quote(uploaded_filename)  # ✅ URL 编码

    return render_template(
        "preview.html",
        task_id=task_id,
        sign_link=sign_link,
        sign_ready=sign_ready,
        employees=employees,
        record=task,  # ✅ 加入传递
        encoded_title=encoded_filename,
    )


@app.route("/save_box/<task_id>", methods=["POST"])
@login_required
def save_box(task_id):
    box_data = request.get_json()  # 这是前端传来的所有box列表

    # 先删除本任务下的所有老的box（防止反复保存产生重复/脏数据）
    SignatureBox.query.filter_by(task_id=task_id).delete()
    db.session.commit()

    # 批量插入每个box
    for box in box_data:
        try:
            new_box = SignatureBox(
                task_id=task_id,
                employee_id=int(box["employee_id"]),
                page=int(box["page"]),
                left=float(box["left"]),
                top=float(box["top"]),
                width=float(box["width"]),
                height=float(box["height"]),
                signed=bool(box.get("signed", False)),
                image=box.get("image"),  # 刚配置时一般为 None
                preview_width=float(box.get("preview_width", 0)),
                preview_height=float(box.get("preview_height", 0)),
            )
            db.session.add(new_box)
        except Exception as e:
            print("❌ 保存 box 时出错", box, e)
    db.session.commit()

    return jsonify({"status": "success"})


@app.route("/sign/<task_id>")
@login_required
def sign_page(task_id):
    boxes = SignatureBox.query.filter_by(task_id=task_id).all()
    if not boxes:
        return "签名区域未配置"

    # 如果模板用 dict，可以转一下；如果模板直接用对象列表也可以
    box_list = [
        {
            "id": box.id,
            "employee_id": box.employee_id,
            "page": int(box.page),
            "left": float(box.left),
            "top": float(box.top),
            "width": float(box.width),
            "height": float(box.height),
            "signed": bool(box.signed),
            "image": box.image,
            "preview_width": float(box.preview_width) if box.preview_width else None,
            "preview_height": float(box.preview_height) if box.preview_height else None,
        }
        for box in boxes
    ]

    return render_template("sign.html", task_id=task_id, boxes=box_list)


@app.route("/submit_sign/<task_id>", methods=["POST"])
@login_required
def submit_sign(task_id):
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if task and task.is_completed:
        return jsonify({"status": "error", "msg": "该签名任务已完成，无法提交签名"})

    data = request.get_json()
    print(f"👉 [SIGN] task_id={task_id} data={data}")

    if not data or not isinstance(data, list):
        return jsonify({"status": "error", "msg": "缺少签名数据"})

    employee_id = data[0].get("employee_id")
    if not employee_id:
        return jsonify({"status": "error", "msg": "缺少签名人信息"})

    updated = False
    for item in data:
        box = SignatureBox.query.filter(
            SignatureBox.task_id == task_id,
            SignatureBox.employee_id == int(item["employee_id"]),
            SignatureBox.page == int(item["page"]),
            db.func.abs(SignatureBox.left - float(item["left"])) < 0.01,
            db.func.abs(SignatureBox.top - float(item["top"])) < 0.01,
        ).first()
        if box and not box.signed:
            box.signed = True
            box.image = item.get("image")
            box.preview_width = item.get("preview_width")
            box.preview_height = item.get("preview_height")
            updated = True

    if not updated:
        return jsonify({"status": "error", "msg": "未匹配到对应签名区域，或已签名"})

    db.session.commit()

    # 更新数据库中的签名状态
    sig_status = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id, employee_id=int(employee_id)
    ).first()
    if sig_status and not sig_status.signed:
        sig_status.signed = True
        db.session.commit()

    # 检查是否所有人都签完，才触发合成 PDF
    all_statuses = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).all()
    if all(s.signed for s in all_statuses):
        print("📄 所有签名区域已签名，开始合成 PDF")

        user_folder = os.path.join(app.config["UPLOAD_FOLDER"], str(current_user.id))
        pdf_path = next(
            (f for f in os.listdir(user_folder) if f.startswith(task_id)),
            None,
        )
        if not pdf_path:
            return jsonify({"status": "error", "msg": "PDF 未找到"})

        full_pdf_path = os.path.join(user_folder, pdf_path)
        final_user_folder = os.path.join(
            app.config["FINAL_FOLDER"], str(current_user.id)
        )
        os.makedirs(final_user_folder, exist_ok=True)
        output_pdf_path = os.path.join(final_user_folder, f"{task_id}_signed.pdf")

        # 构建签名图列表（已签名的）
        signature_boxes = SignatureBox.query.filter_by(
            task_id=task_id, signed=True
        ).all()
        signature_images = []
        for box in signature_boxes:
            if box.image:
                image_base64 = (
                    box.image.split(",")[1] if "," in box.image else box.image
                )
                signature_images.append(
                    {
                        "page": int(box.page),
                        "left": float(box.left),
                        "top": float(box.top),
                        "width": float(box.width),
                        "height": float(box.height),
                        "image_bytes": base64.b64decode(image_base64),
                        "preview_width": (
                            float(box.preview_width) if box.preview_width else 1240
                        ),
                        "preview_height": (
                            float(box.preview_height) if box.preview_height else 1754
                        ),
                    }
                )

        insert_signatures_into_pdf(full_pdf_path, output_pdf_path, signature_images)

        # 标记任务完成
        task.is_completed = True
        db.session.commit()

    return jsonify(
        {"status": "success", "redirect": url_for("sign_submitted", task_id=task_id)}
    )


@app.route("/sign_submitted/<task_id>")
@login_required
def sign_submitted(task_id):
    return render_template("sign_submitted.html", task_id=task_id)


@app.route("/invite/<task_id>")
@login_required
def invite_page(task_id):
    # 查找该任务下所有签名区域（SignatureBox）
    boxes = SignatureBox.query.filter_by(task_id=task_id).all()
    if not boxes:
        return "签名区域未配置"

    # 提取所有涉及到的员工ID
    employee_ids = list({box.employee_id for box in boxes})

    # 获取这些员工的信息
    employees = (
        Employee.query.filter_by(user_id=current_user.id)
        .filter(Employee.local_id.in_(employee_ids))
        .all()
    )

    # 已签名的员工ID集合
    signed_ids = {box.employee_id for box in boxes if box.signed}

    base_url = request.url_root.rstrip("/")

    return render_template(
        "sign_invite.html",
        task_id=task_id,
        sign_url=f"{base_url}/sign_select/{task_id}",
        employees=employees,
        signed_ids=signed_ids,
    )


@app.route("/sign_canvas/<task_id>", defaults={"employee_id": None})
@app.route("/sign_canvas/<task_id>/<int:employee_id>")
def sign_canvas(task_id, employee_id):
    return render_template("sign_canvas.html", task_id=task_id, employee_id=employee_id)


@app.route("/delete_record/<task_id>", methods=["POST"])
@login_required
def delete_record(task_id):
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if task:
        # 删除关联签名状态
        SignatureStatus.query.filter_by(
            user_id=current_user.id, task_id=task_id
        ).delete()

        # 删除所有签名区域
        SignatureBox.query.filter_by(task_id=task_id).delete()

        # 删除题库
        QuizQuestion.query.filter_by(user_id=current_user.id, task_id=task_id).delete()

        # 删除任务本身
        db.session.delete(task)
        db.session.commit()

        # 删除上传的 PDF 文件
        user_folder = os.path.join(app.config["UPLOAD_FOLDER"], str(current_user.id))
        if os.path.exists(user_folder):
            for fname in os.listdir(user_folder):
                if fname.startswith(task_id):
                    os.remove(os.path.join(user_folder, fname))

        # 删除合成后的 PDF 文件
        final_user_folder = os.path.join(
            app.config["FINAL_FOLDER"], str(current_user.id)
        )
        final_path = os.path.join(final_user_folder, f"{task_id}_signed.pdf")
        if os.path.exists(final_path):
            os.remove(final_path)

        return jsonify({"status": "success"})

    return jsonify({"status": "not_found"}), 404


@app.route("/sign_select/<task_id>", methods=["GET", "POST"])
@login_required
def sign_select(task_id):
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if task and task.is_completed:
        return "该签名任务已完成，无法继续签名", 403

    if request.method == "POST":
        employee_id = request.form.get("employee_id")
        return redirect(
            url_for("sign_page_employee", task_id=task_id, employee_id=employee_id)
        )

    # 获取当前任务所有涉及到的员工ID（查 SignatureBox）
    box_emps = SignatureBox.query.filter_by(task_id=task_id).all()
    employee_ids = set(b.employee_id for b in box_emps)
    employees = (
        Employee.query.filter_by(user_id=current_user.id)
        .filter(Employee.id.in_(employee_ids))
        .all()
    )

    return render_template("sign_select.html", task_id=task_id, employees=employees)


@app.route("/sign/<task_id>/<int:employee_id>")
@login_required
def sign_page_employee(task_id, employee_id):
    # ✅ 获取任务
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if not task:
        return "签名任务不存在", 404

    # ✅ 检查是否任务已完成
    status = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id, employee_id=employee_id
    ).first()
    if status and status.signed:
        return "您已完成签名，无法再次签名", 403

    # ✅ 获取 quiz 状态，前端判断是否允许签名，不再强制跳 quiz
    quiz_passed = status.quiz_passed if status else False

    # ✅ 直接查 SignatureBox 表，获取当前员工所有签名区域
    boxes_raw = SignatureBox.query.filter_by(
        task_id=task_id, employee_id=employee_id
    ).all()
    filtered_boxes = []
    for box in boxes_raw:
        filtered_boxes.append(
            {
                "page": int(box.page),
                "left": float(box.left),
                "top": float(box.top),
                "width": float(box.width),
                "height": float(box.height),
                "signed": box.signed,
                "image": box.image,
                "preview_width": (
                    float(box.preview_width) if box.preview_width else None
                ),
                "preview_height": (
                    float(box.preview_height) if box.preview_height else None
                ),
                "employee_id": box.employee_id,
            }
        )

    # ✅ 获取上传的 PDF 文件名并 URL 编码
    user_folder = os.path.join(app.config["UPLOAD_FOLDER"], str(current_user.id))
    uploaded_filename = next(
        (f for f in os.listdir(user_folder) if f.startswith(task_id)),
        None,
    )
    if not uploaded_filename:
        return "PDF 文件未找到", 404

    encoded_title = quote(uploaded_filename)
    employee = Employee.query.filter_by(
        user_id=current_user.id, local_id=employee_id
    ).first()
    employee_name = employee.name if employee else ""

    return render_template(
        "sign.html",
        task_id=task_id,
        boxes=filtered_boxes,
        employee_id=employee_id,
        employee_name=employee_name,
        encoded_title=encoded_title,
        quiz_required=task.quiz_required,
        quiz_passed=quiz_passed,
    )


@app.route("/sign_quiz/<task_id>/<int:employee_id>", methods=["GET", "POST"])
@login_required
def quiz_page(task_id, employee_id):
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if not task:
        return jsonify({"success": False, "msg": "签名任务不存在"}), 404

    questions = QuizQuestion.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).all()

    if request.method == "POST":
        # 用 request.json 读取 AJAX 数据
        data = request.get_json()
        error_message = None
        for q in questions:
            correct = json.loads(q.correct_answers)
            input_name = f"q{q.id}"
            user_answer = data.get(input_name)
            try:
                user_answer = int(user_answer)
            except Exception:
                error_message = "答案格式错误"
                break
            if user_answer != correct[0]:
                error_message = "答题不通过，请重新作答"
                break

        if error_message:
            return jsonify({"success": False, "msg": error_message})

        # 更新当前员工 quiz_passed 状态
        status = SignatureStatus.query.filter_by(
            user_id=current_user.id, task_id=task_id, employee_id=employee_id
        ).first()
        if status:
            status.quiz_passed = True  # ✅ 标记通过
            db.session.commit()  # ✅ 写入数据库
        return jsonify(
            {
                "success": True,
                "redirect": url_for(
                    "sign_canvas", task_id=task_id, employee_id=employee_id
                ),
            }
        )

    # 👇 这一部分是修改的核心
    parsed_questions = []
    for q in questions:
        parsed_questions.append(
            {
                "id": q.id,
                "content": q.content,
                "options": json.loads(q.options),
                "correct_answers": json.loads(q.correct_answers),
            }
        )

    return render_template(
        "sign_quiz.html",
        task_id=task_id,
        employee_id=employee_id,
        questions=parsed_questions,
    )


@app.route("/training_materials", methods=["POST"])
@login_required
def training_materials():
    user_folder = os.path.join("static/training_materials", str(current_user.id))
    os.makedirs(user_folder, exist_ok=True)
    title = request.form.get("title")
    desc = request.form.get("description", "")
    file = request.files.get("file")
    if not (title and file and file.filename.endswith(".pdf")):
        return jsonify({"status": "fail", "msg": "请上传PDF文件并填写标题"}), 200
    filename = secure_filename(file.filename)
    save_path = os.path.join(user_folder, filename)
    file.save(save_path)
    mat = TrainingMaterial(
        user_id=current_user.id,
        title=title,
        description=desc,
        file_path=os.path.join(str(current_user.id), filename),
    )
    db.session.add(mat)
    db.session.commit()
    return jsonify(
        {
            "status": "success",
            "mat": {
                "id": mat.id,
                "title": mat.title,
                "description": mat.description or "",
                "file_path": mat.file_path,
                "created_at": mat.created_at.strftime("%Y-%m-%d %H:%M"),
            },
        }
    )


@app.route("/training_materials/list")
@login_required
def training_materials_list():
    mats = (
        TrainingMaterial.query.filter_by(user_id=current_user.id)
        .order_by(TrainingMaterial.created_at.desc())
        .all()
    )

    def mat2dict(m):
        return {
            "id": m.id,
            "title": m.title,
            "description": m.description or "",
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M"),
            "file_path": m.file_path,
        }

    return jsonify({"mats": [mat2dict(m) for m in mats]})


@app.route("/training_materials/delete/<int:mat_id>", methods=["POST"])
@login_required
def delete_material(mat_id):
    mat = TrainingMaterial.query.filter_by(id=mat_id, user_id=current_user.id).first()
    if mat:
        abs_path = os.path.join("static/training_materials", mat.file_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)
        db.session.delete(mat)
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "not_found"}), 404


@app.route("/training_questions/list")
@login_required
def training_questions_list():
    material_id = request.args.get("material_id", type=int)
    questions = (
        TrainingQuestion.query.filter_by(
            user_id=current_user.id, material_id=material_id
        )
        .order_by(TrainingQuestion.id.desc())
        .all()
    )

    def q2dict(q):
        return {
            "id": q.id,
            "content": q.content,
            "options": json.loads(q.options),
            "correct_answers": json.loads(q.correct_answers),
            "multiple": q.multiple,
        }

    return jsonify({"questions": [q2dict(q) for q in questions]})


@app.route("/training_questions/new", methods=["POST"])
@login_required
def training_question_new():
    data = request.get_json()
    q = TrainingQuestion(
        user_id=current_user.id,
        material_id=data["material_id"],
        content=data["content"],
        options=json.dumps(data["options"]),
        correct_answers=json.dumps(data["correct_answers"]),
        multiple=data["multiple"],
    )
    db.session.add(q)
    db.session.commit()
    return jsonify({"status": "success"})


@app.route("/training_questions/get/<int:qid>")
@login_required
def training_question_get(qid):
    q = TrainingQuestion.query.filter_by(id=qid, user_id=current_user.id).first()
    if not q:
        return jsonify({"status": "not_found"})
    return jsonify(
        {
            "status": "success",
            "q": {
                "id": q.id,
                "content": q.content,
                "options": json.loads(q.options),
                "correct_answers": json.loads(q.correct_answers),
                "multiple": q.multiple,
            },
        }
    )


@app.route("/training_questions/edit/<int:qid>", methods=["POST"])
@login_required
def training_question_edit(qid):
    q = TrainingQuestion.query.filter_by(id=qid, user_id=current_user.id).first()
    if not q:
        return jsonify({"status": "not_found"})
    data = request.get_json()
    q.content = data["content"]
    q.options = json.dumps(data["options"])
    q.correct_answers = json.dumps(data["correct_answers"])
    q.multiple = data["multiple"]
    db.session.commit()
    return jsonify({"status": "success"})


@app.route("/training_questions/delete/<int:qid>", methods=["POST"])
@login_required
def training_question_delete(qid):
    q = TrainingQuestion.query.filter_by(id=qid, user_id=current_user.id).first()
    if not q:
        return jsonify({"status": "not_found"})
    db.session.delete(q)
    db.session.commit()
    return jsonify({"status": "success"})


# 新建培训任务
@app.route("/training_task/new", methods=["POST"])
@login_required
def create_training_task():
    title = request.form.get("title")
    material_id = request.form.get("material_id")
    description = request.form.get("description", "")
    deadline = request.form.get("deadline")
    employee_ids = request.form.getlist("employee_ids")
    max_attempts = int(request.form.get("max_attempts", 1))
    pass_score_ratio = float(request.form.get("pass_score_ratio", 80)) / 100.0

    if not (title and material_id and employee_ids):
        return "缺少必要参数", 400

    # 1. 创建 TrainingTask
    task = TrainingTask(
        title=title,
        material_id=material_id,
        description=description,
        deadline=deadline if deadline else None,
        created_at=datetime.now(),
        max_attempts=max_attempts,
        pass_score_ratio=pass_score_ratio,
    )
    db.session.add(task)
    db.session.commit()

    # 2. 为每个员工生成 TrainingTaskEmployee 记录
    for emp_id in employee_ids:
        rec = TrainingTaskEmployee(task_id=task.id, employee_id=emp_id, status="未完成")
        db.session.add(rec)
    db.session.commit()
    return redirect(url_for("training_task_invite", task_id=task.id))


@app.route("/training_task/<int:task_id>")
@login_required
def training_task_detail(task_id):
    task = TrainingTask.query.filter_by(id=task_id).first()
    if not task:
        return "未找到该培训任务", 404

    # 查询培训材料
    material = TrainingMaterial.query.filter_by(id=task.material_id).first()

    # 查询参与员工及完成情况
    employees = (
        db.session.query(Employee, TrainingTaskEmployee)
        .join(TrainingTaskEmployee, Employee.id == TrainingTaskEmployee.employee_id)
        .filter(TrainingTaskEmployee.task_id == task_id)
        .all()
    )
    emp_list = [{"name": emp.name, "status": tte.status} for emp, tte in employees]

    # 生成培训答题链接（假设员工访问 /training_answer/<task_id> 开始答题）
    base_url = request.url_root.rstrip("/")
    answer_url = f"{base_url}/training_answer/{task_id}"

    return render_template(
        "training_task_invite.html",
        task=task,
        material=material,
        employees=emp_list,
        answer_url=answer_url,
    )


@app.route("/training_task/invite/<int:task_id>")
@login_required
def training_task_invite(task_id):
    task = TrainingTask.query.get(task_id)
    material = TrainingMaterial.query.get(task.material_id)
    records = TrainingTaskEmployee.query.filter_by(task_id=task_id).all()
    emp_ids = [rec.employee_id for rec in records]
    employees = Employee.query.filter(Employee.id.in_(emp_ids)).all()
    # 查询每人历史
    histories = {}
    for emp in employees:
        hists = (
            TrainingAnswerHistory.query.filter_by(task_id=task.id, employee_id=emp.id)
            .order_by(TrainingAnswerHistory.attempt_num.asc())
            .all()
        )
        histories[emp.id] = [
            {
                "score": h.score,
                "is_passed": h.is_passed,
                "submit_time": h.submit_time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for h in hists
        ]

    emp_list = []
    for emp in employees:
        status = next(
            (rec.status for rec in records if rec.employee_id == emp.id), "未完成"
        )
        emp_list.append({"id": emp.id, "name": emp.name, "status": status})

    base_url = request.url_root.rstrip("/")
    return render_template(
        "training_task_invite.html",
        task=task,
        material=material,
        base_url=base_url,
        employees=emp_list,
        histories=histories,
    )


@app.route("/training_answer/<int:task_id>/<int:employee_id>", methods=["GET", "POST"])
def training_answer(task_id, employee_id):
    tte = TrainingTaskEmployee.query.filter_by(
        task_id=task_id, employee_id=employee_id
    ).first()
    task = TrainingTask.query.get(task_id)
    material = TrainingMaterial.query.get(task.material_id)
    employee = Employee.query.get(employee_id)
    questions = TrainingQuestion.query.filter_by(material_id=material.id).all()
    parsed_questions = [
        {
            "id": q.id,
            "content": q.content,
            "options": json.loads(q.options),
            "correct_answers": json.loads(q.correct_answers),
        }
        for q in questions
    ]
    # 1. 判断整个任务是否已截止（只按截止日期）
    if task.deadline and datetime.now().date() > task.deadline:
        return render_template(
            "training_answer_disabled.html", msg="本次培训任务已截止，无法再答题。"
        )

    # 2. 判断当前员工是否已完成
    if tte.status == "已完成":
        # 渲染成绩页面（可传成绩等信息）
        return render_template(
            "training_answer_disabled.html",
            msg="你已完成本次答题，无需重复提交。",
            score=tte.score,
            is_passed=tte.is_passed,
            attempts=tte.attempts,
        )

    if request.method == "POST":
        # 已通过，无需再提交
        if getattr(tte, "is_passed", False):
            return jsonify(
                {
                    "success": False,
                    "msg": "已通过，无需重复答题",
                    "passed": True,
                    "attempts": tte.attempts,
                    "max_attempts": task.max_attempts,
                }
            )
        # 已用完次数，不允许再提交
        if getattr(tte, "attempts", 0) >= task.max_attempts:
            # 也要将状态置为已完成
            tte.status = "已完成"
            db.session.commit()
            return jsonify(
                {
                    "success": False,
                    "msg": "已用完最大答题次数，无法再提交",
                    "passed": False,
                    "attempts": tte.attempts,
                    "max_attempts": task.max_attempts,
                }
            )

        # 允许本次提交
        answers = request.get_json()
        score = 0
        for q in parsed_questions:
            qid = f"q{q['id']}"
            ans = int(answers.get(qid, -1))
            if ans in q["correct_answers"]:
                score += 1

        tte.attempts = (tte.attempts or 0) + 1  # 计数+1
        total = len(parsed_questions)
        correct_ratio = score / total if total else 0
        pass_score = getattr(task, "pass_score_ratio", 0.8)
        passed = correct_ratio >= pass_score

        # 1. 保存本次答题历史
        history = TrainingAnswerHistory(
            task_id=task.id,
            employee_id=employee_id,
            attempt_num=tte.attempts,
            score=score,
            is_passed=passed,
            submit_time=datetime.now(),
        )
        db.session.add(history)

        # 2. 更新员工总表
        tte.score = score
        tte.submit_time = datetime.now()
        tte.is_passed = passed

        # 达到最大次数，或通过，都算已完成
        if passed or tte.attempts >= task.max_attempts:
            tte.status = "已完成"
        else:
            tte.status = "未完成"

        db.session.commit()

        # 3. 返回
        if not passed and tte.attempts >= task.max_attempts:
            return jsonify(
                {
                    "success": False,
                    "passed": False,
                    "score": score,
                    "total": total,
                    "msg": "未通过且已用完所有答题机会",
                    "attempts": tte.attempts,
                    "max_attempts": task.max_attempts,
                }
            )
        elif not passed:
            return jsonify(
                {
                    "success": False,
                    "passed": False,
                    "score": score,
                    "total": total,
                    "msg": f"未通过，可重试（剩余{task.max_attempts - tte.attempts}次）",
                    "attempts": tte.attempts,
                    "max_attempts": task.max_attempts,
                }
            )
        else:
            return jsonify(
                {
                    "success": True,
                    "passed": True,
                    "score": score,
                    "total": total,
                    "msg": "答题通过！",
                    "attempts": tte.attempts,
                    "max_attempts": task.max_attempts,
                }
            )

    return render_template(
        "training_answer.html",
        task=task,
        material=material,
        questions=parsed_questions,
        employee=employee,
        tte=tte,
        chr=chr,
    )


@app.route("/training_answer_select/<int:task_id>", methods=["GET", "POST"])
def training_answer_select(task_id):
    task = TrainingTask.query.get(task_id)
    # 找到所有参与该任务的员工
    records = TrainingTaskEmployee.query.filter_by(task_id=task_id).all()
    emp_ids = [rec.employee_id for rec in records]
    employees = Employee.query.filter(Employee.id.in_(emp_ids)).all()
    if request.method == "POST":
        employee_id = request.form.get("employee_id")
        return redirect(
            url_for("training_answer", task_id=task_id, employee_id=employee_id)
        )
    return render_template(
        "training_answer_select.html", task=task, employees=employees
    )


@app.route("/training_stats")
@login_required
def training_stats():
    tasks = TrainingTask.query.order_by(TrainingTask.created_at.desc()).all()

    data = []
    for task in tasks:
        material = TrainingMaterial.query.get(task.material_id)
        ttes = TrainingTaskEmployee.query.filter_by(task_id=task.id).all()
        total = len(ttes)
        done = sum(1 for t in ttes if t.status == "已完成")
        data.append(
            {
                "id": task.id,
                "title": task.title,
                "material": material.title if material else "(无)",
                "created_at": task.created_at.strftime("%Y-%m-%d %H:%M"),
                "deadline": (
                    task.deadline.strftime("%Y-%m-%d") if task.deadline else "-"
                ),
                "progress": f"{done}/{total}",
                "is_completed": done == total and total > 0,
            }
        )
    return jsonify({"tasks": data})


@app.route("/delete_training_task/<int:task_id>", methods=["POST"])
@login_required
def delete_training_task(task_id):
    task = TrainingTask.query.get(task_id)
    if not task:
        return jsonify({"status": "not_found"}), 404

    # 删除所有答题历史
    TrainingAnswerHistory.query.filter_by(task_id=task_id).delete()
    # 删除参与记录
    TrainingTaskEmployee.query.filter_by(task_id=task_id).delete()
    # 删除任务本身
    db.session.delete(task)
    db.session.commit()
    return jsonify({"status": "success"})


@app.route("/training_task/get/<int:task_id>")
@login_required
def training_task_get(task_id):
    task = TrainingTask.query.get(task_id)
    if not task:
        return jsonify({"status": "not_found"})

    material = TrainingMaterial.query.get(task.material_id)
    ttes = TrainingTaskEmployee.query.filter_by(task_id=task_id).all()
    employees = Employee.query.filter(
        Employee.id.in_([t.employee_id for t in ttes])
    ).all()
    emp_map = {e.id: e for e in employees}

    stats = {
        "total": len(ttes),
        "done": sum(1 for t in ttes if t.status == "已完成"),
        "avg_score": (
            round(sum((t.score or 0) for t in ttes) / len(ttes), 2) if ttes else 0
        ),
        "pass_ratio": (
            round(100.0 * sum(1 for t in ttes if t.is_passed) / len(ttes), 2)
            if ttes
            else 0
        ),
    }

    return jsonify(
        {
            "status": "success",
            "task": {
                "id": task.id,
                "title": task.title,
                "created_at": task.created_at.strftime("%Y-%m-%d %H:%M"),
                "material": material.title if material else "(无)",
                "deadline": task.deadline.strftime("%Y-%m-%d") if task.deadline else "",
                "description": task.description or "",
                "employees": [
                    {"id": t.employee_id, "name": emp_map[t.employee_id].name}
                    for t in ttes
                ],
                "stats": stats,
            },
        }
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # 首次启动创建所有表
    app.run(host="0.0.0.0", port=5050, debug=True)
