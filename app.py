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
app.config["META_FOLDER"] = "static/meta"
app.config["FINAL_FOLDER"] = "static/final"
app.config["SIGN_URL"] = "http://127.0.0.1:5000/sign/"

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(app.config["META_FOLDER"], exist_ok=True)
os.makedirs(app.config["FINAL_FOLDER"], exist_ok=True)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///qianxuntong.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# 定义中国时区
CHINA_TZ = timezone("Asia/Shanghai")


class SignatureTask(db.Model):
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
    id = db.Column(db.Integer, primary_key=True)  # 物理主键
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    local_id = db.Column(db.Integer, nullable=False)  # 用户空间自增逻辑id
    name = db.Column(db.String(50), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "local_id"),)  # 保证唯一


class QuizQuestion(db.Model):
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
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)


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
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], f"{task_id}_{filename}")
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
    return render_template("index.html", tasks=task_info, employees=employees)


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

    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    sign_ready = False

    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            boxes = json.load(f)
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

    uploaded_filename = next(
        (f for f in os.listdir(app.config["UPLOAD_FOLDER"]) if f.startswith(task_id)),
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
    # ✅ 读取提交的 box 数据
    box_data = request.get_json()

    # ✅ 保存到 meta 文件
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    with open(meta_path, "w") as f:
        json.dump(box_data, f)

    # ✅ 检查任务是否存在
    task = SignatureTask.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).first()
    if not task:
        return jsonify({"status": "error", "msg": "任务不存在，请重新上传文件"}), 400

    selected_ids = task.get_employee_ids()
    selected_ids = [int(i) for i in selected_ids]

    # ✅ 查询已存在的签名状态
    existing_statuses = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).all()
    existing_employee_ids = {s.employee_id for s in existing_statuses}

    # ✅ 建立新的签名状态（避免重复创建）
    new_statuses = []
    for box in box_data:
        try:
            employee_id = int(box["employee_id"])
        except (KeyError, ValueError):
            continue  # 跳过非法或缺失的记录

        if employee_id not in existing_employee_ids and employee_id in selected_ids:
            new_statuses.append(
                SignatureStatus(
                    user_id=current_user.id,
                    task_id=task_id,
                    employee_id=employee_id,
                    signed=False,
                )
            )

    if new_statuses:
        db.session.add_all(new_statuses)
        db.session.commit()

    return jsonify({"status": "success"})


@app.route("/sign/<task_id>")
@login_required
def sign_page(task_id):
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    if not os.path.exists(meta_path):
        return "签名区域未配置"

    with open(meta_path, "r") as f:
        boxes = json.load(f)

    # ✅ 关键修复：确保 page 是 int，避免模板中匹配失败
    for box in boxes:
        box["page"] = int(box["page"])

    return render_template("sign.html", task_id=task_id, boxes=boxes)


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
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    if not os.path.exists(meta_path):
        return jsonify({"status": "error", "msg": "签名区域未配置"})

    with open(meta_path, "r") as f:
        boxes = json.load(f)

    employee_id = str(data[0].get("employee_id"))
    if not employee_id:
        return jsonify({"status": "error", "msg": "缺少签名人信息"})

    updated = False
    for item in data:
        item_left = float(item["left"])
        item_top = float(item["top"])
        item_page = int(item["page"])

        for box in boxes:
            if (
                int(box["page"]) == item_page
                and abs(float(box["left"]) - item_left) < 1e-1
                and abs(float(box["top"]) - item_top) < 1e-1
                and str(box.get("employee_id")) == employee_id
            ):
                if not box.get("signed"):  # ✅ 避免重复覆盖
                    box["signed"] = True
                    box["image"] = item["image"]
                    box["preview_width"] = item["preview_width"]
                    box["preview_height"] = item["preview_height"]
                    updated = True
                break

    if not updated:
        return jsonify({"status": "error", "msg": "未匹配到对应签名区域，或已签名"})

    # ✅ 保存签名图到 meta 文件
    with open(meta_path, "w") as f:
        json.dump(boxes, f)

    # ✅ 更新数据库中的签名状态
    sig_status = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id, employee_id=int(employee_id)
    ).first()
    if sig_status and not sig_status.signed:
        sig_status.signed = True
        db.session.commit()

    # ✅ 检查是否所有人都签完，才触发合成 PDF
    all_statuses = SignatureStatus.query.filter_by(
        user_id=current_user.id, task_id=task_id
    ).all()
    if all(s.signed for s in all_statuses):
        print("📄 所有签名区域已签名，开始合成 PDF")

        pdf_path = next(
            (
                f
                for f in os.listdir(app.config["UPLOAD_FOLDER"])
                if f.startswith(task_id)
            ),
            None,
        )
        if not pdf_path:
            return jsonify({"status": "error", "msg": "PDF 未找到"})

        full_pdf_path = os.path.join(app.config["UPLOAD_FOLDER"], pdf_path)
        output_pdf_path = os.path.join(
            app.config["FINAL_FOLDER"], f"{task_id}_signed.pdf"
        )

        # ✅ 构建签名图列表（已签名的）
        signature_images = [
            {
                "page": int(box["page"]),
                "left": float(box["left"]),
                "top": float(box["top"]),
                "width": float(box["width"]),
                "height": float(box["height"]),
                "image_bytes": base64.b64decode(box["image"].split(",")[1]),
                "preview_width": float(box.get("preview_width", 1240)),
                "preview_height": float(box.get("preview_height", 1754)),
            }
            for box in boxes
            if box.get("signed") and box.get("image")
        ]

        insert_signatures_into_pdf(full_pdf_path, output_pdf_path, signature_images)

        # ✅ 标记任务完成
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
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    if not os.path.exists(meta_path):
        return "签名区域未配置"

    with open(meta_path, "r") as f:
        boxes = json.load(f)

    employee_ids = list({int(b["employee_id"]) for b in boxes})
    employees = (
        Employee.query.filter_by(user_id=current_user.id)
        .filter(Employee.local_id.in_(employee_ids))
        .all()
    )

    signed_ids = set()
    for box in boxes:
        if box.get("signed"):
            signed_ids.add(int(box["employee_id"]))

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

        # 删除任务本身
        db.session.delete(task)
        db.session.commit()

        # 删除上传的 PDF 文件
        for fname in os.listdir(app.config["UPLOAD_FOLDER"]):
            if fname.startswith(task_id):
                os.remove(os.path.join(app.config["UPLOAD_FOLDER"], fname))

        # 删除合成后的 PDF 文件
        final_path = os.path.join(app.config["FINAL_FOLDER"], f"{task_id}_signed.pdf")
        if os.path.exists(final_path):
            os.remove(final_path)

        # 删除签名区域配置 JSON
        meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
        if os.path.exists(meta_path):
            os.remove(meta_path)

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

    # 获取当前任务中涉及的员工
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    if not os.path.exists(meta_path):
        return "签名区域未配置"

    with open(meta_path, "r") as f:
        boxes = json.load(f)

    employee_ids = set(b["employee_id"] for b in boxes)
    employees = (
        Employee.query.filter_by(user_id=current_user.id)
        .filter(Employee.local_id.in_(employee_ids))
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

    # ✅ 加载签名区域
    meta_path = os.path.join(app.config["META_FOLDER"], f"{task_id}.json")
    if not os.path.exists(meta_path):
        return "签名区域未配置"

    with open(meta_path, "r") as f:
        all_boxes = json.load(f)

    filtered_boxes = [
        box for box in all_boxes if int(box["employee_id"]) == employee_id
    ]
    for box in filtered_boxes:
        box["page"] = int(box["page"])

    # ✅ 获取上传的 PDF 文件名并 URL 编码
    uploaded_filename = next(
        (f for f in os.listdir(app.config["UPLOAD_FOLDER"]) if f.startswith(task_id)),
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


# 本地调试
if __name__ == "__main__":
    app.run(debug=True)

# # 局域网调试
# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5001, debug=True)
