// ==========================
// 1. 页面主菜单区切换逻辑
// ==========================
function showSection(section) {
    // 隐藏所有区块，仅显示目标section
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('records-section').style.display = 'none';
    document.getElementById('employees-section').style.display = 'none';
    document.getElementById('training-materials-section').style.display = 'none';
    document.getElementById('training-task-section').style.display = 'none';
    document.getElementById('training-stats-section').style.display = 'none';
    document.getElementById(section + '-section').style.display = 'block';

    // 各功能区特定初始化
    if (section === 'training-materials') loadMaterialList();
    if (section === 'question-bank') loadQuestionMaterials();
    if (section === 'training-task') document.getElementById('training-task-section').style.display = 'block';
    if (section === 'training-stats') loadTrainingStats();
}

function navigateAndRemember(section) {
    // 菜单切换记忆，刷新后还在当前区
    localStorage.setItem("activeSection", section);
    location.reload();
}


// ==========================
// 2. 签名发布区（PDF自动填标题、题库配置等相关）
// ==========================

// --------- 2.1 页面初始化 & PDF自动填标题 ---------
document.addEventListener('DOMContentLoaded', function () {
    // 初始激活分区
    const active = localStorage.getItem("activeSection") || "upload";
    showSection(active);

    // 答题功能勾选时自动初始化
    const quizToggle = document.getElementById("quizToggle");
    if (quizToggle.checked) toggleQuizConfig();

    // 选文件自动填标题
    const fileInput = document.getElementById('fileInput');
    const titleInput = document.getElementById('titleInput');
    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file && titleInput) {
            const baseName = file.name.replace(/\.[^.]+$/, '');
            titleInput.value = baseName;
            titleInput.focus();
        }
    });
});

// --------- 2.2 答题功能开关与题库配置区块显示控制 ---------
function toggleQuizConfig() {
    const checkbox = document.getElementById("quizToggle");
    const configArea = document.getElementById("quizConfigArea");
    configArea.style.display = checkbox.checked ? "block" : "none";

    if (checkbox.checked) {
        // 如果还没有题目，则默认添加一个
        const container = document.getElementById("question-container");
        if (container.children.length === 0) {
            addQuestion();
        }
        updateDeleteButtons();
    }
}

// --------- 2.3 答题题库配置（动态添加题目/选项/校验等） ---------
// 添加选项（每个题块内）
window.addOption = function (btn, qIndex) {
    let questionDiv = btn.closest('.quiz-question-block');
    let container = questionDiv.querySelector('.options-container');
    let optIndex = container.children.length;
    let div = document.createElement('div');
    div.className = 'option-item';
    div.style.marginBottom = '7px';
    div.innerHTML = `
        <input type="text" name="questions[${qIndex}][options][]" placeholder="请输入选项" required style="width:65%;">
        <label>
            <input type="radio" name="questions[${qIndex}][answers]" value="${optIndex}">
            正确
        </label>
        <button type="button" onclick="this.parentElement.remove()">❌</button>
    `;
    container.appendChild(div);
}

// 题库配置：添加题目
let questionIndex = 0;
window.addQuestion = function () {
    const container = document.getElementById("question-container");
    const index = questionIndex++;

    const div = document.createElement("div");
    div.className = "quiz-question-block";
    div.style = "margin-bottom:20px;padding:16px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9;position:relative;";

    div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label class="question-title"><b>题目 X</b></label>
            <span>
                <button type="button" class="btn-add" onclick="addQuestion()">➕ 添加题目</button>
                <button type="button" class="btn-delete" onclick="removeQuestion(this)">🗑 删除题目</button>
            </span>
        </div>
        <input type="text" name="questions[${index}][content]" placeholder="请输入题干内容" required style="margin-bottom:10px;">
        <label>选项</label>
        <div class="options-container"></div>
        <button type="button" onclick="addOption(this, ${index})">➕ 添加选项</button>
    `;
    container.appendChild(div);

    // 自动添加两个初始选项
    const btn = div.querySelector("button[onclick^='addOption']");
    addOption(btn, index);
    addOption(btn, index);

    updateDeleteButtons();
    refreshQuestionLabels();
};

// 题库配置：删除题目
window.removeQuestion = function (btn) {
    btn.closest(".quiz-question-block").remove();
    updateDeleteButtons();
    refreshQuestionLabels();
};

// 题库配置：删除选项
window.removeOption = function (btn) {
    btn.parentElement.remove();
};

// 题库配置：禁用/启用删除题目按钮
function updateDeleteButtons() {
    const questions = document.querySelectorAll(".quiz-question-block");
    const delBtns = document.querySelectorAll(".quiz-question-block .btn-delete");
    if (questions.length <= 1) {
        delBtns.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = 0.5;
            btn.style.cursor = "not-allowed";
        });
    } else {
        delBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = "";
            btn.style.cursor = "";
        });
    }
}

// 题库配置：刷新题号
function refreshQuestionLabels() {
    document.querySelectorAll('.quiz-question-block').forEach((div, i) => {
        const label = div.querySelector('.question-title');
        if (label) {
            label.textContent = `题目 ${i + 1}`;
        }
    });
}

// ------- 2.4 表单校验（签名发布表单）-------
document.getElementById('uploadForm').addEventListener('submit', function (e) {
    // 标题校验
    const titleInput = document.getElementById('titleInput');
    if (!titleInput.value.trim()) {
        showToast('请填写标题', true);
        titleInput.focus();
        e.preventDefault();
        return false;
    }
    // 文件校验
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        showToast('请选择文件', true);
        fileInput.focus();
        e.preventDefault();
        return false;
    }
    const allowedExt = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;
    const maxSize = 20 * 1024 * 1024;
    if (!allowedExt.test(fileInput.files[0].name)) {
        showToast('仅支持 PDF、Word、图片格式文件', true);
        fileInput.focus();
        e.preventDefault();
        return false;
    }
    if (fileInput.files[0].size > maxSize) {
        showToast('文件太大，请上传20MB以内的文件', true);
        fileInput.value = '';
        fileInput.focus();
        e.preventDefault();
        return false;
    }
    // 员工校验
    const employeeChecked = document.querySelectorAll('[name="employee_ids"]:checked');
    if (!employeeChecked.length) {
        showToast('请至少选择一个员工', true);
        e.preventDefault();
        return false;
    }
    // 题库校验（如果启用答题功能）
    const quizEnabled = document.getElementById("quizToggle").checked;
    if (quizEnabled) {
        // 遍历每个题块
        const questions = document.querySelectorAll('.quiz-question-block');
        for (let i = 0; i < questions.length; i++) {
            const qDiv = questions[i];
            const content = qDiv.querySelector(`input[name^="questions"][name$="[content]"]`);
            const options = qDiv.querySelectorAll('input[name^="questions"][name$="[options][]"]');
            const answer = qDiv.querySelector('input[type="radio"]:checked');
            // ==== 新增：跳过完全空白的题块 ====
            const contentEmpty = !content || !content.value.trim();
            const allOptionsEmpty = Array.from(options).every(opt => !opt.value.trim());
            if (contentEmpty && allOptionsEmpty) {
                // 这题完全没填，跳过校验
                continue;
            }
            // ==== 只校验真正有内容的题 ====
            if (!content || !content.value.trim()) {
                showToast(`请填写第${i + 1}题的题干`, true);
                e.preventDefault();
                return false;
            }
            if (options.length < 2) {
                showToast(`第${i + 1}题至少需要2个选项`, true);
                e.preventDefault();
                return false;
            }
            let hasEmptyOption = false;
            options.forEach(opt => {
                if (!opt.value.trim()) hasEmptyOption = true;
            });
            if (hasEmptyOption) {
                showToast(`第${i + 1}题存在空选项`, true);
                e.preventDefault();
                return false;
            }
            if (!answer) {
                showToast(`请为第${i + 1}题选择正确答案`, true);
                e.preventDefault();
                return false;
            }
        }
    }
});

// 文件大小前端实时校验
document.getElementById('fileInput').addEventListener('change', function () {
    const file = this.files[0];
    if (file && file.size > 20 * 1024 * 1024) {
        showToast('文件太大，请上传20MB以内的文件', true);
        this.value = '';
    }
});


// ==========================
// 3. 签名记录区（任务删除）
// ==========================

function deleteTask(taskId, button, event) {
    event.preventDefault();

    if (!confirm("确定删除该签名任务？")) return;

    fetch(`/delete_record/${taskId}`, {
        method: "POST"
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                button.closest("tr").remove();
                showToast('✅ 删除成功');
            } else {
                showToast("❌ 删除失败", true);
            }
        });
}


// ==========================
// 4. 培训任务发布区
// ==========================

// 员工全选/清空
function selectAllEmployees2() {
    document.querySelectorAll('#training-task-section .employee-item input[type="checkbox"]').forEach(cb => cb.checked = true);
}
function clearAllEmployees2() {
    document.querySelectorAll('#training-task-section .employee-item input[type="checkbox"]').forEach(cb => cb.checked = false);
}

document.getElementById('trainingTaskForm').addEventListener('submit', function (e) {
    e.preventDefault();

    // 构造 FormData
    const form = e.target;
    const formData = new FormData(form);

    fetch('/training_task/new', {
        method: 'POST',
        body: formData,
    })
        .then(res => {
            // 尝试先解析为json（出错时）
            return res.json().catch(() => null) || res.text();
        })
        .then(data => {
            if (typeof data === 'object' && data.status === 'fail') {
                showToast(data.msg, true);
            } else if (typeof data === 'object' && data.status === 'success') {
                // 正常跳转（比如任务详情页）
                window.open(data.redirect, "_blank");
            } else {
                showToast("未知响应/服务器返回异常", true);
            }
        })
});



// ==========================
// 5. 培训材料区（上传、展示、删除）
// ==========================

// 加载材料列表（去后端拿材料数据并渲染）
function loadMaterialList() {
    fetch('/training_materials/list')
        .then(r => r.json())
        .then(data => renderMaterialList(data.mats));
}

// 渲染材料列表（重置tbody内容并插入所有行）（把现有材料数据渲染出来）
function renderMaterialList(mats) {
    const tbody = document.querySelector('#training-materials-section tbody');
    tbody.innerHTML = '';
    mats.forEach((mat, idx) => insertMaterialRow(mat, idx + 1));
}

// 插入单行材料数据到表格（含预览和删除按钮）
function insertMaterialRow(mat, serial) {
    const tbody = document.querySelector('#training-materials-section tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${serial}</td>
        <td>${mat.id}</td>
        <td>${mat.title}</td>
        <td>${mat.created_at}</td>
        <td>
            <a class="btn-view" href="/static/training_materials/${mat.file_path}" target="_blank">🔍 预览</a>
            <button class="btn-delete" onclick="deleteMaterial(${mat.id}, this, event)">🗑 删除</button>
        </td>
    `;
    tbody.appendChild(tr);
}

// 上传按钮点击，自动触发文件选择
document.getElementById('uploadMaterialBtn').onclick = function () {
    document.getElementById('hiddenMaterialFile').click();
};

// 文件选择后自动上传（仅限PDF）
document.getElementById('hiddenMaterialFile').onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const allowedExt = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;
    const maxSize = 20 * 1024 * 1024; // 20MB

    if (!allowedExt.test(file.name)) {
        showToast('❌ 仅支持 PDF、Word、图片格式文件！', true);
        return;
    }

    if (file.size > maxSize) {
        showToast('❌ 文件太大，请上传20MB以内的文件', true);
        return;
    }

    // 构造FormData，标题用文件名
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, '')); // 标题直接用文件名
    fetch('/training_materials', {
        method: 'POST',
        body: formData
    }).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            showToast('✅ 上传成功！');
            loadMaterialList();
        } else {
            showToast('❌ ' + (data.msg || '上传失败！'), true);
        }
        e.target.value = ''; // 清空选择
    }).catch(err => {
        showToast('❌ 上传异常！', true);
        e.target.value = '';
    });
};

// 删除材料（确认后发请求并删除表格行）
function deleteMaterial(id, btn, event) {
    event.preventDefault();
    if (confirm("确认删除该材料？")) {
        fetch(`/training_materials/delete/${id}`, { method: "POST" })
            .then(r => r.json()).then(data => {
                if (data.status === "success") {
                    btn.closest("tr").remove();
                    showToast('✅ 删除成功');
                } else {
                    showToast("❌ 删除失败", true);
                }
            });
    }
}




// ==========================
// 6. 培训题库区（加载材料、题目列表、弹窗增改删）
// ==========================

let currentMaterialId = null;  // 当前选中的材料ID
let editingQid = null;         // 当前正在编辑的题目ID（用于弹窗）

// ------- 6.1 加载材料列表并填充下拉框，自动加载首个材料的题目 -------
function loadQuestionMaterials() {
    fetch('/training_materials/list')
        .then(r => r.json())
        .then(data => {
            const select = document.getElementById('materialSelect');
            select.innerHTML = '';  // 清空下拉框
            data.mats.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.title;
                select.appendChild(opt);
            });
            if (data.mats.length > 0) {
                currentMaterialId = data.mats[0].id;
                select.value = currentMaterialId;
                loadQuestions(currentMaterialId); // 自动加载首个材料的题目
            } else {
                currentMaterialId = null;
                document.getElementById('questionTableBody').innerHTML = '<tr><td colspan="6">暂无培训材料</td></tr>';
            }
        });
}

// 切换材料时，加载对应的题库题目
document.getElementById('materialSelect').addEventListener('change', function () {
    currentMaterialId = this.value;
    loadQuestions(currentMaterialId);
});

// ------- 6.2 加载指定材料下的所有题目 -------
function loadQuestions(materialId) {
    fetch(`/training_questions/list?material_id=${materialId}`)
        .then(r => r.json())
        .then(data => renderQuestionTable(data.questions || []));
}

// ------- 6.3 渲染题目表格列表 -------
function renderQuestionTable(questions) {
    const tbody = document.getElementById('questionTableBody');
    if (!questions.length) {
        tbody.innerHTML = '<tr><td colspan="6">本材料下暂无题目</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    questions.forEach((q, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${q.id}</td>
            <td>${q.content}</td>
            <td>单选</td>
            <td>${q.options.map((opt, idx) => `<div>${String.fromCharCode(65 + idx)}. ${opt}</div>`).join('')}</td>
            <td>${q.correct_answers.map(i => String.fromCharCode(65 + i)).join(', ')}</td>
            <td>
                <button class="btn-add" onclick="editQuestion(${q.id})">编辑</button>
                <button class="btn-delete" onclick="deleteQuestion(${q.id}, this)">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ======= 6.4 题目弹窗相关 =======

// 打开题目新增/编辑弹窗（带内容回填）
function showQuestionModal(q = null) {
    // 新建/编辑弹窗填充内容
    editingQid = q ? q.id : null;
    document.getElementById('modalTitle').textContent = q ? '编辑题目' : '新建题目';
    document.getElementById('modalQid').value = q ? q.id : '';
    document.getElementById('modalContent').value = q ? q.content : '';
    let options = q ? q.options : ['', '']; // 没有内容默认2个空选项
    let answerIndex = (q && q.correct_answers && q.correct_answers.length) ? q.correct_answers[0] : 0;
    renderOptions(options, answerIndex);
    document.getElementById('questionModal').style.display = '';
}

// 关闭弹窗
function hideQuestionModal() {
    document.getElementById('questionModal').style.display = 'none';
}

// 渲染所有选项（编辑/新增弹窗内）
function renderOptions(options, answerIndex) {
    const container = document.getElementById('optionContainer');
    container.innerHTML = '';
    options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.style.marginBottom = '7px';
        div.innerHTML = `
            <input type="text" name="option" value="${opt}" style="width:65%;" required>
            <span class="correct-label">
                <input type="radio" name="answer" value="${idx}" ${answerIndex === idx ? 'checked' : ''}>
                正确
            </span>
            <button type="button" onclick="this.parentElement.remove()">❌</button>
        `;
        container.appendChild(div);
    });
}

// 增加一个空选项（弹窗内用）
window.addOption = function () {
    const container = document.getElementById('optionContainer');
    const optionCount = container.children.length;
    const div = document.createElement('div');
    div.className = 'option-item';
    div.style.marginBottom = '7px';
    div.innerHTML = `
        <input type="text" name="option" value="" style="width:65%;" required>
        <span class="correct-label">
            <input type="radio" name="answer" value="${optionCount}">
            正确
        </span>
        <button type="button" onclick="this.parentElement.remove()">❌</button>
    `;
    container.appendChild(div);
}

// ======= 6.5 新建/编辑题目表单提交 =======
// 校验内容，保存到后端，关闭弹窗并刷新题库表格
document.getElementById('questionForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const qid = document.getElementById('modalQid').value;
    const content = document.getElementById('modalContent').value.trim();
    const options = Array.from(document.querySelectorAll('#optionContainer input[name="option"]')).map(i => i.value.trim());
    const answer = getCheckedAnswer();

    // 前端校验
    if (!content || options.some(o => !o) || answer === null) {
        showToast('请完整填写题目内容、选项，并选择一个正确答案', true);
        return;
    }
    if (options.length < 2) {
        showToast('选项至少2个', true);
        return;
    }

    // 发起新增/编辑请求
    fetch(qid ? `/training_questions/edit/${qid}` : '/training_questions/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            material_id: currentMaterialId,
            content,
            options,
            correct_answers: [answer], // 单选，数组只有一个元素
            multiple: false // 后端字段保留
        })
    }).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            hideQuestionModal();
            loadQuestions(currentMaterialId);
            showToast('✅ 题目保存成功');
        } else {
            showToast(data.msg || '保存失败', true);
        }
    }).catch(() => {
        showToast('保存请求异常', true);
    });
});

// 获取当前选中的答案序号
function getCheckedAnswer() {
    const r = document.querySelector('#optionContainer input[type="radio"]:checked');
    return r ? +r.value : null;
}

// 编辑题目时，从后端获取内容回填弹窗
function editQuestion(qid) {
    fetch(`/training_questions/get/${qid}`).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            showQuestionModal(data.q);
        } else {
            showToast('获取题目失败', true);
        }
    }).catch(() => {
        showToast('获取题目异常', true);
    });
}

// 删除题目（确认后删除行）
function deleteQuestion(qid, btn) {
    // 这里如果想要更优雅，可以用 showMsgModal + 确认按钮弹窗
    if (!confirm('确定删除该题目？')) return;
    fetch(`/training_questions/delete/${qid}`, { method: 'POST' }).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            btn.closest('tr').remove();
            showToast('✅ 删除成功');
        } else {
            showToast('删除失败', true);
        }
    }).catch(() => {
        showToast('删除请求异常', true);
    });
}


// ==========================
// 7. 培训记录区（列表加载、删除、统计、表单导出PDF）
// ==========================

// ------- 7.1 加载培训记录列表（所有任务统计） -------
function loadTrainingStats() {
    fetch('/training_stats')
        .then(r => r.json())
        .then(data => {
            renderTrainingStatsTable(data.tasks || []);
        });
}

// ------- 7.2 渲染培训记录表格到页面 -------
function renderTrainingStatsTable(tasks) {
    const tbody = document.querySelector('#trainingStatsTable tbody');
    if (!tasks.length) {
        // 没有任务时显示空状态
        tbody.innerHTML = '<tr><td colspan="7">暂无培训记录</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    tasks.forEach((task, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.material}</td>
            <td>${task.created_at}</td>
            <td>${task.deadline}</td>
            <td>
                ${task.is_completed ? '✅ 已完成' : '❌ 未完成'}（${task.progress}）
            </td>
            <td>
                <a class="btn-view" href="/training_task/invite/${task.id}" target="_blank">🔍 查看</a>
                <button class="btn-add" onclick="showTrainingRecordModal(${task.id})">📝 制表</button>
                <button class="btn-delete" onclick="deleteTrainingTask(${task.id}, this, event)">🗑 删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ------- 7.3 删除培训任务 -------
function deleteTrainingTask(taskId, btn, event) {
    event.preventDefault();
    if (!confirm("确定删除该培训任务？")) return;
    fetch(`/delete_training_task/${taskId}`, {
        method: "POST"
    }).then(res => res.json()).then(data => {
        if (data.status === "success") {
            btn.closest("tr").remove();
        } else {
            showToast('删除失败', true);
        }
    });
}

// ------- 7.4 展示培训记录表填写弹窗，回填内容/草稿 -------
function showTrainingRecordModal(taskId) {
    // 先获取任务基本信息
    fetch(`/training_task/get/${taskId}`).then(r => r.json()).then(data => {
        const task = data.task;

        // 填写默认值
        document.getElementById('trTitle').value = task.title;
        document.getElementById('trTime').value = task.created_at;
        document.getElementById('trTrainer').value = window.currentUsername || '';
        document.getElementById('trEmployeeList').value = task.employees.map(e => e.name).join('、');
        document.getElementById('trResult').value =
            `本次培训共${task.stats.total}人，平均得分${task.stats.avg_score || '--'}分，合格率${task.stats.pass_ratio || '--'}%。`;
        document.getElementById('trPlace').value = "签训通平台";
        let today = new Date();
        document.getElementById('trDate').value = today.toISOString().split('T')[0];
        document.getElementById('trReviewDate').value = '';
        document.getElementById('trStation').value = '';
        document.getElementById('trSummary').value = '';
        document.getElementById('trNote').value = '';

        // 再查后端数据库有无已保存正式数据
        fetch(`/api/get_training_record/${taskId}`)
            .then(res => res.json())
            .then(r => {
                if (r.status === "success") {
                    const rec = r.record;
                    // 用数据库内容覆盖（有内容的字段）
                    if (rec.station) document.getElementById('trStation').value = rec.station;
                    if (rec.title) document.getElementById('trTitle').value = rec.title;
                    if (rec.time) document.getElementById('trTime').value = rec.time;
                    if (rec.place) document.getElementById('trPlace').value = rec.place;
                    if (rec.trainer) document.getElementById('trTrainer').value = rec.trainer;
                    if (rec.employees) document.getElementById('trEmployeeList').value = rec.employees;
                    if (rec.summary) document.getElementById('trSummary').value = rec.summary;
                    if (rec.result) document.getElementById('trResult').value = rec.result;
                    if (rec.note) document.getElementById('trNote').value = rec.note;
                    if (rec.date) document.getElementById('trDate').value = rec.date;
                    if (rec.review_date) document.getElementById('trReviewDate').value = rec.review_date;
                }

                // 最后查浏览器草稿，优先覆盖（如果有）
                let draft = localStorage.getItem('trainingRecordDraft_' + taskId);
                if (draft) {
                    draft = JSON.parse(draft);
                    if (draft.trStation) document.getElementById('trStation').value = draft.trStation;
                    if (draft.trSummary) document.getElementById('trSummary').value = draft.trSummary;
                    if (draft.trResult) document.getElementById('trResult').value = draft.trResult;
                    if (draft.trNote) document.getElementById('trNote').value = draft.trNote;
                    if (draft.trReviewDate) document.getElementById('trReviewDate').value = draft.trReviewDate;
                }

                // 最终展示
                document.getElementById('trainingRecordModal').setAttribute('data-taskid', taskId);
                document.getElementById('trainingRecordModal').style.display = 'flex';
            });
    });
}


// 关闭培训记录表弹窗
function hideTrainingRecordModal() {
    document.getElementById('trainingRecordModal').style.display = 'none';
}

// ------- 7.6 导出培训记录PDF -------
function submitTrainingRecord(e) {
    e.preventDefault();
    let modal = document.getElementById('trainingRecordModal');
    let taskId = modal.getAttribute('data-taskid');
    localStorage.removeItem('trainingRecordDraft_' + taskId);   // 导出后移除草稿

    let data = {
        station: document.getElementById('trStation').value,
        title: document.getElementById('trTitle').value,
        time: document.getElementById('trTime').value,
        place: document.getElementById('trPlace').value,
        trainer: document.getElementById('trTrainer').value,
        employees: document.getElementById('trEmployeeList').value,
        summary: document.getElementById('trSummary').value,
        result: document.getElementById('trResult').value,
        note: document.getElementById('trNote').value,
        date: document.getElementById('trDate').value,
        reviewDate: document.getElementById('trReviewDate').value
    };

    // 发到后端，返回 PDF
    fetch('/api/export_training_record', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(res => {
            if (!res.ok) throw new Error("网络错误，导出失败");
            return res.blob();
        })
        .then(blob => {
            // 创建临时下载链接
            let a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = (data.title || '培训记录') + '-培训记录.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(err => showToast(`导出PDF失败：${err.message}`, true));
}

// ------- 7.7 培训制表保存按钮 -------
function saveTrainingRecord() {
    let modal = document.getElementById('trainingRecordModal');
    let taskId = modal.getAttribute('data-taskid');
    let data = {
        task_id: taskId,
        station: document.getElementById('trStation').value,
        title: document.getElementById('trTitle').value,
        time: document.getElementById('trTime').value,
        place: document.getElementById('trPlace').value,
        trainer: document.getElementById('trTrainer').value,
        employees: document.getElementById('trEmployeeList').value,
        summary: document.getElementById('trSummary').value,
        result: document.getElementById('trResult').value,
        note: document.getElementById('trNote').value,
        date: document.getElementById('trDate').value,
        review_date: document.getElementById('trReviewDate').value
    };
    fetch('/api/save_training_record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(res => res.json())
        .then(r => {
            if (r.status === 'success') {
                showToast('培训记录已保存');
            } else {
                showToast('保存失败：' + (r.msg || ''), true);
            }
        });
}



// ==========================
// 8. 员工管理区（增删、全选、清空）
// ==========================

// -------- 8.1 新增员工表单提交，自动写入到员工表 --------
document.querySelector('#employees-section form').addEventListener('submit', function (e) {
    e.preventDefault();  // 阻止表单默认刷新

    const nameInput = this.querySelector('input[name="name"]'); // 获取姓名输入框
    const name = nameInput.value.trim(); // 去空格
    if (!name) return;  // 未填写则不提交

    // 发POST请求到后端，创建新员工
    fetch("/employee/new", {
        method: "POST",
        body: new URLSearchParams({ name })
    }).then(res => res.json()).then(data => {
        // 新增成功，把新员工插入表格
        if (data.status === "success") {
            const tbody = document.querySelector('#employees-section tbody');
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${data.id}</td>
                <td>${data.name}</td>
                <td>
                    <button class="btn-delete" onclick="deleteEmployee(${data.id}, this, event)">🗑 删除</button>
                </td>`;
            tbody.prepend(tr);  // 插入表头
            nameInput.value = '';  // 清空输入框
        }
    });
});

// -------- 8.2 删除员工（确认后发送请求，并从表格删除行） --------
function deleteEmployee(id, button, event) {
    event.preventDefault();

    if (!confirm("确认删除该员工？")) return; // 二次确认

    // 发POST请求删除员工
    fetch(`/employee/delete/${id}`, {
        method: "POST"
    }).then(res => res.json()).then(data => {
        if (data.status === "success") {
            button.closest("tr").remove();  // 删除当前行
        } else {
            showToast("删除失败", true);
        }
    });
}

// -------- 8.3 员工全选/清空按钮逻辑 --------

// “全选”所有员工复选框
function selectAllEmployees() {
    document.querySelectorAll('.employee-item input[type="checkbox"]').forEach(cb => cb.checked = true);
}

// “清空”所有员工复选框
function clearAllEmployees() {
    document.querySelectorAll('.employee-item input[type="checkbox"]').forEach(cb => cb.checked = false);
}


// ==========================
// 9. 通用弹窗/提示（全局消息）
// ==========================

// 显示模态消息弹窗（重要信息提示，需用户手动关闭）
// Show a modal dialog with a message (for important info, requires user to close)
function showMsgModal(msg) {
    document.getElementById('msgModalContent').textContent = msg; // 设置弹窗内容
    document.getElementById('msgModal').style.display = 'block';  // 显示弹窗
}

// 关闭模态消息弹窗
// Close the modal dialog
function closeMsgModal() {
    document.getElementById('msgModal').style.display = 'none';
}

// 显示操作提示（支持“成功/失败”两种颜色），自动消失
// Show a toast notification (auto disappear, different color for success/failure)
function showToast(msg, isError = false, duration = 1800) {
    const ele = document.getElementById('toastMsg');
    ele.textContent = msg;                                  // 设置提示内容
    ele.style.background = isError ? '#e74c3c' : '#222';    // 失败红色，成功深色
    ele.style.display = 'block';
    ele.style.opacity = '1';

    // 动画渐入渐出，自动隐藏
    // Fade out after duration
    clearTimeout(ele._hideTimer); // 清除旧的定时器，防止叠加
    ele._hideTimer = setTimeout(() => {
        ele.style.opacity = '0'; // 渐隐
        // 渐隐动画后隐藏
        setTimeout(() => {
            ele.style.display = 'none';
        }, 300);
    }, duration);
}

function openAIGenerateModal() {
    document.getElementById('aiGenerateModal').style.display = 'block';
    document.getElementById('aiPdfTextPreview').style.display = 'none';
    document.getElementById('aiPdfTextPreview').textContent = '';
    // document.getElementById('aiQuestionDesc').value = ''; // 可以也清空输入
}
function hideAIGenerateModal() {
    document.getElementById('aiGenerateModal').style.display = 'none';
}

// 提交AI生成题目
function submitAIGenerate() {
    // 获取上传的文件
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('请先选择一个PDF文件', true);
        return;
    }

    showToast('正在提取PDF文字…');
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/pdf2text', {
        method: 'POST',
        body: formData
    }).then(r => r.json()).then(res => {
        if (res.status === 'success') {
            // 显示OCR文本内容到弹窗
            const preview = document.getElementById('aiPdfTextPreview');
            preview.textContent = res.text;
            preview.style.display = 'block';
            showToast('提取成功');
        } else {
            showToast(res.msg || 'PDF文字提取失败', true);
        }
    }).catch(() => showToast('PDF提取服务异常', true));
}

