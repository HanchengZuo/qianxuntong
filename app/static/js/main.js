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
    document.getElementById('exam-generator-section').style.display = 'none';
    document.getElementById('training-stats-section').style.display = 'none';
    document.getElementById(section + '-section').style.display = 'block';

    // 各功能区特定初始化
    if (section === 'training-materials') loadMaterialList();
    if (section === 'question-bank') loadQuestionMaterials();
    if (section === 'training-task') document.getElementById('training-task-section').style.display = 'block';
    if (section === 'training-stats') loadTrainingStats();
    if (section === 'exam-generator') initExamGenerator();
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
        // 如果还没有题目，则默认添加一个题目
        const container = document.getElementById("question-container");
        if (container.children.length === 0) {
            addQuestion();  // 确保添加题目
        }
        updateDeleteButtons();
    }
}


// --------- 2.3 答题题库配置（动态添加题目/选项/校验等） ---------
let questionIndex = 0;
window.addQuestion = function () {
    const container = document.getElementById("question-container");
    const index = questionIndex++; // 更新索引

    const div = document.createElement("div");
    div.className = "quiz-question-block";
    div.id = "quiz-question-" + (index + 1);
    div.style = "margin-bottom:20px;padding:16px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9;position:relative;";

    div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label class="question-title"><b>题目 ${index + 1}</b></label>
            <span>
                <button type="button" class="btn-add" onclick="addQuestion()">➕ 添加题目</button>
                <button type="button" class="btn-delete" onclick="removeQuestion(this)">🗑 删除题目</button>
            </span>
        </div>
        <textarea name="questions[${index}][content]" 
                  placeholder="请输入题干内容" 
                  required 
                  style="width:100%;min-height:42px;resize:vertical;margin-bottom:10px;line-height:1.5;"></textarea>
        <label>选项</label>
        <div class="options-container"></div>
        <button type="button" onclick="addQuizOption(this, ${index})">➕ 添加选项</button>
    `;
    container.appendChild(div); // 将新题目添加到题目容器中

    // 自动添加两个初始选项
    const btn = div.querySelector("button[onclick^='addQuizOption']");
    addQuizOption(btn, index);
    addQuizOption(btn, index);
    addQuizOption(btn, index);
    addQuizOption(btn, index); // 默认添加四个选项

    updateDeleteButtons();
    refreshQuestionLabels();
};

window.addQuizOption = function (btn, qIndex) {
    if (!btn) return;
    let questionDiv = btn.closest('.quiz-question-block');
    if (!questionDiv) return;
    let container = questionDiv.querySelector('.options-container');
    if (!container) return;
    let optIndex = container.children.length;

    // 关键：统一样式class，label加上.correct-label
    let div = document.createElement('div');
    div.className = 'option-item';
    div.style.marginBottom = '7px';
    div.innerHTML = `
        <textarea 
            name="questions[${qIndex}][options][]" 
            class="option-textarea"
            placeholder="请输入选项"
            required
            style="resize:vertical;line-height:1.5;min-height:32px;"
        ></textarea>
        <label class="correct-label">
            <input type="radio" name="questions[${qIndex}][answers]" value="${optIndex}">
            <span>正确</span>
        </label>
        <button type="button" class="delete-option-btn" onclick="this.parentElement.remove()">❌</button>
    `;
    container.appendChild(div);
};


document.addEventListener('input', function (e) {
    if (e.target.tagName.toLowerCase() === 'textarea') {
        e.target.style.height = 'auto'; // 重置
        e.target.style.height = (e.target.scrollHeight) + 'px'; // 自适应
    }
});



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
    const maxSize = 30 * 1024 * 1024;
    if (!allowedExt.test(fileInput.files[0].name)) {
        showToast('仅支持 PDF、Word、图片格式文件', true);
        fileInput.focus();
        e.preventDefault();
        return false;
    }
    if (fileInput.files[0].size > maxSize) {
        showToast('文件太大，请上传30MB以内的文件', true);
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
    if (file && file.size > 30 * 1024 * 1024) {
        showToast('文件太大，请上传30MB以内的文件', true);
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

// 渲染材料列表（重置tbody内容并插入所有行）
function renderMaterialList(mats) {
    const tbody = document.querySelector('#training-materials-section tbody');
    tbody.innerHTML = '';
    mats.forEach((mat, idx) => insertMaterialRow(mat, idx + 1));
}

// 插入单行材料数据到表格（含预览、删除按钮和查看文本按钮）
function insertMaterialRow(mat, serial) {
    const tbody = document.querySelector('#training-materials-section tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${serial}</td>
        <td class="hidden-column">${mat.id}</td>
        <td>${mat.title}</td>
        <td>${mat.created_at}</td>
        <td>
            <a class="btn-view" href="/static/training_materials/${mat.file_path}" target="_blank">🔍 预览</a>
            <button class="btn-delete" onclick="deleteMaterial(${mat.id}, this, event)">🗑 删除</button>
            ${mat.text_content ? `<button class="btn-view-text" onclick="viewText(${mat.id})">查看文本</button>` : ''}
        </td>
    `;
    tbody.appendChild(tr);
}

// 查看文本按钮点击事件
function viewText(materialId) {
    fetch(`/training_materials/get_text/${materialId}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.text) {
                showToast('文本已加载');
                // 更新新的文本弹窗内容
                const textModalContent = document.getElementById('textModalContent');
                textModalContent.textContent = data.text;

                // 显示弹窗
                document.getElementById('textModal').style.display = 'flex';
            } else {
                showToast('❌ 获取文本失败', true);
            }
        }).catch(() => {
            showToast('❌ 获取文本异常', true);
        });
}

// 关闭新的文本弹窗
function closeTextModal() {
    document.getElementById('textModal').style.display = 'none';
}

// 上传按钮点击，自动触发文件选择
document.getElementById('uploadMaterialBtn').onclick = function () {
    document.getElementById('hiddenMaterialFile').click();
};

// 文件选择后自动上传（仅限PDF）
document.getElementById('hiddenMaterialFile').onchange = function (e) {
    const file = e.target.files[0];  // 获取选择的文件
    if (!file) return;  // 如果没有文件被选择，则直接返回

    const allowedExt = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;  // 允许的文件扩展名
    const maxSize = 30 * 1024 * 1024;  // 最大文件大小 30MB

    // 检查文件扩展名是否符合要求
    if (!allowedExt.test(file.name)) {
        showToast('❌ 仅支持 PDF、Word、图片格式文件！', true);
        return;  // 文件格式不正确，终止后续流程
    }

    // 检查文件大小是否超过限制
    if (file.size > maxSize) {
        showToast('❌ 文件太大，请上传30MB以内的文件', true);
        return;  // 文件大小超出限制，终止后续流程
    }

    // 上传文件到后端
    uploadMaterialFile(file);
};

// 文件上传并解析的逻辑
function uploadMaterialFile(file) {
    // 构造FormData，标题用文件名
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));  // 标题使用文件名（去除扩展名）

    // 锁定页面
    lockPage();

    // 显示提示
    showToast('正在转换PDF为文本，请稍等...', false, true);

    // 发送文件到后端
    fetch('/training_materials', {
        method: 'POST',
        body: formData
    }).then(r => r.json()).then(data => {
        if (data.status === 'success') {
            showToast('✅ 上传成功！');
            loadMaterialList();  // 上传成功后加载材料列表
            // 显示查看文本按钮
            insertMaterialRow(data.mat);
        } else {
            showToast('❌ ' + (data.msg || '上传失败！'), true);
        }
        unlockPage();  // 解锁页面
        document.getElementById('hiddenMaterialFile').value = '';  // 清空选择框
    }).catch(err => {
        showToast('❌ 上传异常！', true);
        unlockPage();  // 解锁页面
        document.getElementById('hiddenMaterialFile').value = '';  // 清空选择框
    });
}


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
function loadQuestions(materialId, callback) {
    fetch(`/training_questions/list?material_id=${materialId}`)
        .then(r => r.json())
        .then(data => {
            renderQuestionTable(data.questions || []);
            if (callback) callback();
        });
}

// ------- 6.3 渲染题目表格列表 -------
function renderQuestionTable(questions) {
    questions.sort((a, b) => a.id - b.id);
    const tbody = document.getElementById('questionTableBody');
    if (!questions.length) {
        tbody.innerHTML = '<tr><td colspan="7">本材料下暂无题目</td></tr>'; // 注意colspan要和表头列数一致
        return;
    }
    tbody.innerHTML = '';
    questions.forEach((q, idx) => {
        // 判断题型显示文本
        let typeText = q.qtype || (q.multiple ? '多选' : '单选');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td class="hidden-column">${q.id}</td>
            <td>${q.content}</td>
            <td>${typeText}</td>
            <td>${q.options.map((opt, oi) => {
            // 如果选项本身已以 A. / B. / C. / D. 开头，则直接展示
            return /^[A-D][.．、]\s*/.test(opt)
                ? `<div>${opt}</div>`
                : `<div>${String.fromCharCode(65 + oi)}. ${opt}</div>`
        }).join('')
            }</td>
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
window.addBankOption = function () {
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
            <td class="hidden-column">${task.id}</td>
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
function showToast(msg, isErr = false, isLoading = false) {
    const t = document.getElementById('toastMsg');
    if (!t) return;
    t.textContent = msg;
    t.style.background = isErr ? "#e74c3c" : "#222";
    t.style.opacity = 1;
    t.style.display = "block";
    // 如果是loading，不自动消失
    if (!isLoading) {
        setTimeout(() => {
            t.style.opacity = 0;
            setTimeout(() => t.style.display = "none", 300);
        }, 2500);
    }
}

function hideToast() {
    const t = document.getElementById('toastMsg');
    if (t) {
        t.style.opacity = 0;
        setTimeout(() => t.style.display = "none", 300);
    }
}

function lockPage() {
    // 显示蒙层，禁用AI弹窗关闭和生成按钮
    document.getElementById('globalMask').style.display = 'block';
    const aiGenBtn = document.getElementById('aiGenerateBtn');
    if (aiGenBtn) aiGenBtn.disabled = true;
    // 禁用关闭
    const closeBtn = document.querySelector('#aiGenerateModal span[onclick*="hideAIGenerateModal"]');
    if (closeBtn) closeBtn.style.pointerEvents = "none";
}
function unlockPage() {
    document.getElementById('globalMask').style.display = 'none';
    const aiGenBtn = document.getElementById('aiGenerateBtn');
    if (aiGenBtn) aiGenBtn.disabled = false;
    const closeBtn = document.querySelector('#aiGenerateModal span[onclick*="hideAIGenerateModal"]');
    if (closeBtn) closeBtn.style.pointerEvents = "";
}


// ==========================
// 10. 签名发布区域的AI生成题目
// ==========================

function openAIGenerateModal() {
    document.getElementById('aiGenerateModal').style.display = 'block';
    // 重置loading和错误提示
    document.getElementById('aiGenLoading').style.display = 'none';
    document.getElementById('aiGenError').style.display = 'none';
}
function hideAIGenerateModal() {
    document.getElementById('aiGenerateModal').style.display = 'none';
}

// 真正的AI生成题目提交（先提取PDF文本，再调用AI接口）
function submitAIGenerate() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('请先选择一个PDF文件', true);
        return;
    }
    const count = document.getElementById('aiQCount').value || 1;
    const level = document.getElementById('aiQLevel').value || 'easy';

    showToast('正在读取PDF内容，请稍候…', false, true);
    lockPage();
    document.getElementById('aiGenLoading').style.display = 'block';
    document.getElementById('aiGenError').style.display = 'none';

    // 步骤1：提取PDF文本
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/pdf2text', {
        method: 'POST',
        body: formData
    })
        .then(r => r.json())
        .then(res => {
            if (res.status !== 'success' || !res.text) {
                unlockPage();
                hideToast();
                document.getElementById('aiGenLoading').style.display = 'none';
                showToast(res.msg || 'PDF识别失败', true);
                document.getElementById('aiGenError').style.display = 'block';
                document.getElementById('aiGenError').textContent = res.msg || 'PDF识别失败';
                return;
            }
            // 步骤2：AI生成题目
            showToast('正在AI生成题目，预计1-3分钟，请勿关闭或刷新页面，耐心等待即可…', false, true);
            fetch('/api/sign_ai_generate_questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: res.text,
                    type: 'single',
                    count: count,
                    level: level
                })
            })
                .then(r => r.json())
                .then(res2 => {
                    unlockPage();
                    hideToast();
                    document.getElementById('aiGenLoading').style.display = 'none';

                    if (res2.status === 'success') {
                        const container = document.getElementById("question-container");
                        const newQuestions = res2.questions || [];
                        let quizBlocks = container.querySelectorAll('.quiz-question-block');
                        let aiFillIndex = 0;

                        // 优先复用“第一个空白题块”
                        if (quizBlocks.length > 0) {
                            let firstBlock = quizBlocks[0];
                            let contentTextarea = firstBlock.querySelector('textarea[name$="[content]"]');
                            let optionTextareas = firstBlock.querySelectorAll('textarea[name^="questions"][name$="[options][]"]');
                            let allEmpty = (!contentTextarea.value.trim()) && Array.from(optionTextareas).every(o => !o.value.trim());

                            if (allEmpty && newQuestions.length > 0) {
                                // 填充AI生成的第一题到第一个空白题
                                contentTextarea.value = newQuestions[0].content;
                                // 清空默认选项
                                let optionsContainer = firstBlock.querySelector('.options-container');
                                optionsContainer.innerHTML = '';
                                let options = newQuestions[0].options || [];
                                let answer = typeof newQuestions[0].answer === "number" ? newQuestions[0].answer : 0;
                                options.forEach((opt, oi) => {
                                    let btn = firstBlock.querySelector('button[onclick^="addQuizOption"]');
                                    addQuizOption(btn, 0); // 题号用0
                                    let optTextareas = firstBlock.querySelectorAll('textarea[name^="questions"][name$="[options][]"]');
                                    if (optTextareas[oi]) optTextareas[oi].value = opt;
                                    let radios = firstBlock.querySelectorAll('input[type="radio"]');
                                    if (oi == answer && radios[oi]) radios[oi].checked = true;
                                });
                                aiFillIndex = 1;
                            }
                        }

                        // 其余题目都直接 addQuestion
                        for (let qi = aiFillIndex; qi < newQuestions.length; qi++) {
                            addQuestion();
                            let block = container.lastChild;
                            block.querySelector('textarea[name$="[content]"]').value = newQuestions[qi].content;
                            let options = newQuestions[qi].options || [];
                            let answer = typeof newQuestions[qi].answer === "number" ? newQuestions[qi].answer : 0;
                            block.querySelector('.options-container').innerHTML = '';
                            options.forEach((opt, oi) => {
                                let btn = block.querySelector('button[onclick^="addQuizOption"]');
                                addQuizOption(btn, questionIndex - 1); // 用最新的题号
                                let optTextareas = block.querySelectorAll('textarea[name^="questions"][name$="[options][]"]');
                                if (optTextareas[oi]) optTextareas[oi].value = opt;
                                let radios = block.querySelectorAll('input[type="radio"]');
                                if (oi == answer && radios[oi]) radios[oi].checked = true;
                            });
                        }

                        hideAIGenerateModal();
                        setTimeout(function () {
                            const q1 = document.getElementById('quiz-question-1');
                            if (q1) q1.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 100);
                        showToast('AI题目生成成功');
                    } else {
                        let msg = res.msg || 'AI生成失败';
                        // 针对常见错误码定制友好提示
                        if (res.code == 401) {
                            msg = 'API认证失败，请检查API Key设置。';
                        } else if (res.code == 402) {
                            msg = 'API账户余额不足，请充值后重试。';
                        } else if (res.code == 422) {
                            msg = '参数错误，请联系管理员检查配置。';
                        } else if (res.code == 429) {
                            msg = '请求过于频繁，请稍后再试。';
                        } else if (res.code == 500) {
                            msg = 'AI服务器故障，请稍后再试。';
                        } else if (res.code == 503) {
                            msg = 'AI服务繁忙，请等待片刻后重试。';
                        }
                        // 弹窗+toast都给到
                        document.getElementById('aiGenError').style.display = 'block';
                        document.getElementById('aiGenError').textContent = msg;
                        showToast(msg, true);
                    }
                })
                .catch((err) => {
                    unlockPage();
                    hideToast();
                    document.getElementById('aiGenLoading').style.display = 'none';
                    const errMsg = 'AI服务异常: ' + err;
                    document.getElementById('aiGenError').style.display = 'block';
                    document.getElementById('aiGenError').textContent = errMsg;
                    showToast(errMsg, true);
                });
        })
        .catch((err) => {
            unlockPage();
            hideToast();
            document.getElementById('aiGenLoading').style.display = 'none';
            const errMsg = 'PDF内容提取失败: ' + err;
            document.getElementById('aiGenError').style.display = 'block';
            document.getElementById('aiGenError').textContent = errMsg;
            showToast(errMsg, true);
        });
}

// ==========================
// 11. 培训系统的AI生成题目
// ==========================

function openAIGenerateQBankModal() {
    document.getElementById('aiGenerateQBankModal').style.display = 'block';
    document.getElementById('aiGenQBankLoading').style.display = 'none';
    document.getElementById('aiGenQBankError').style.display = 'none';
}
function hideAIGenerateQBankModal() {
    document.getElementById('aiGenerateQBankModal').style.display = 'none';
}

function submitAIGenerateQBank() {
    const materialSelect = document.getElementById('materialSelect');
    const materialId = materialSelect.value;
    if (!materialId) {
        showToast('请先选择培训材料', true);
        return;
    }
    const qType = document.getElementById('aiQBankType').value;
    const qCount = document.getElementById('aiQBankCount').value || 3;
    const qLevel = document.getElementById('aiQBankLevel').value || 'easy';

    showToast('正在AI生成题目，预计1-3分钟，请勿关闭或刷新页面，耐心等待即可…', false, true);
    document.getElementById('aiGenQBankLoading').style.display = 'block';
    document.getElementById('aiGenQBankError').style.display = 'none';

    lockPage();  // ====== ① 锁死页面防止乱点 ======

    fetch(`/training_materials/get_text/${materialId}`).then(r => r.json()).then(res => {
        if (res.status !== 'success' || !res.text) {
            showToast('获取材料文本失败', true);
            document.getElementById('aiGenQBankLoading').style.display = 'none';
            unlockPage();
            return;
        }
        fetch('/api/ai_generate_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                material_id: materialId,
                text: res.text,
                type: qType,
                count: qCount,
                level: qLevel
            })
        }).then(r => r.json()).then(data => {
            document.getElementById('aiGenQBankLoading').style.display = 'none';
            if (data.status === 'success' && data.questions && data.questions.length) {
                // ====== ② 批量插入题目，Promise.all后再刷新 ======
                let insertPromises = data.questions.map(q => insertAIQuestionToQBank(q, qType));
                Promise.all(insertPromises).then(() => {
                    hideAIGenerateQBankModal();
                    showToast('AI题目生成成功');
                    // ====== ③ 刷新题库后自动滚动到底部 ======
                    loadQuestions(materialId, () => {
                        // 延迟50ms等渲染完
                        setTimeout(() => {
                            const tbody = document.getElementById('questionTableBody');
                            if (tbody && tbody.lastElementChild) {
                                tbody.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
                            }
                        }, 50);
                    });
                }).finally(() => {
                    unlockPage(); // ====== ④ 解锁页面 ======
                });
            } else {
                const msg = data.msg || 'AI生成失败';
                document.getElementById('aiGenQBankError').style.display = 'block';
                document.getElementById('aiGenQBankError').textContent = msg;
                showToast(msg, true);
                unlockPage();
            }
        }).catch(err => {
            document.getElementById('aiGenQBankLoading').style.display = 'none';
            document.getElementById('aiGenQBankError').style.display = 'block';
            document.getElementById('aiGenQBankError').textContent = 'AI服务异常: ' + err;
            showToast('AI服务异常', true);
            unlockPage();
        });
    });
}

// insertAIQuestionToQBank 优化为返回 Promise
function insertAIQuestionToQBank(q, qType) {
    let options = [];
    let correct_answers = [];
    if (qType === 'single') {
        options = q.options;
        correct_answers = [q.answer];
    } else if (qType === 'judge') {
        options = ['正确', '错误'];
        correct_answers = [q.answer];
    }
    // 返回 promise 以便批量插入后统一刷新
    return fetch('/training_questions/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            material_id: currentMaterialId,
            content: q.content,
            options: options,
            correct_answers: correct_answers,
            multiple: false,
            type: qType
        })
    });
}

// ========== 12. 试卷生成A4 PDF ==========

let examQuestions = [];  // 当前加载的题目
let allExamMaterials = []; // 缓存所有材料

function initExamGenerator() {
    // 1. 加载所有材料填充下拉框
    fetch('/training_materials/list')
        .then(r => r.json())
        .then(data => {
            allExamMaterials = data.mats || [];
            const select = document.getElementById('examMaterialSelect');
            select.innerHTML = '<option value="">请选择材料</option>';
            allExamMaterials.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.title;
                select.appendChild(opt);
            });
        });

    // 2. 监听切换，加载题库
    document.getElementById('examMaterialSelect').onchange = function () {
        const matId = this.value;
        if (!matId) {
            examQuestions = [];
            renderExamPreview();
            return;
        }
        fetch(`/training_questions/list?material_id=${matId}`)
            .then(r => r.json())
            .then(data => {
                examQuestions = data.questions || [];
                renderExamPreview();
                setTimeout(() => {
                    document.getElementById('examPreview').scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 100);
            });
    };

    // 新增：参数输入框实时监听刷新预览
    [
        'examHeader',
        'examTitle',
        'examSubtitle',
        'examTime',
        'examScore',
        'examPass'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderExamPreview);
    });

    // 3. 表单提交（生成PDF）
    document.getElementById('examGeneratorForm').onsubmit = function (e) {
        e.preventDefault();
        exportExamToPDF();
    };

    // 初始清空
    examQuestions = [];
    renderExamPreview();
}


// 题目列表渲染 + 删除
function renderExamPreview() {
    const box = document.getElementById('examPreview');
    const header = document.getElementById('examHeader').value.trim();
    const title = document.getElementById('examTitle').value.trim();
    const subtitle = document.getElementById('examSubtitle').value.trim();
    const time = document.getElementById('examTime').value.trim();
    const score = document.getElementById('examScore').value.trim();
    const pass = document.getElementById('examPass').value.trim();

    // 分类
    const judgeQuestions = examQuestions.filter(q => (q.qtype === 'judge' || (!q.options || q.options.length === 2)));
    const singleQuestions = examQuestions.filter(q => (q.qtype === 'single' || (q.options && q.options.length > 2)));

    // 计算每题分值
    const judgeTotal = 40;
    const singleTotal = 60;
    const judgeScore = judgeQuestions.length ? Math.round(judgeTotal / judgeQuestions.length * 100) / 100 : 0;
    const singleScore = singleQuestions.length ? Math.round(singleTotal / singleQuestions.length * 100) / 100 : 0;

    let html = `
        <div style="font-size:22px;font-weight:600;text-align:center;">${header || '<span style="color:#bbb;">（试卷抬头）</span>'}</div>
        <div style="font-size:26px;font-weight:bold;text-align:center;margin:18px 0 8px 0;">
            ${title || '<span style="color:#bbb;">（试卷标题）</span>'}
        </div>
        <div style="font-size:17px;color:#666;text-align:center;margin-bottom:18px;">
            ${subtitle || '<span style="color:#bbb;">（副标题）</span>'}
        </div>
        <div style="text-align:center;margin-bottom:18px;">
            <span style="margin-right:22px;">考试时长：${time || '<span style="color:#bbb;">（时长）</span>'}</span>
            <span style="margin-right:22px;">满分：${score || '<span style="color:#bbb;">（满分）</span>'}</span>
            <span>及格线：${pass || '<span style="color:#bbb;">（及格线）</span>'}</span>
        </div>
        <div style="text-align:center;margin-bottom:10px;color:#888;">
            站名：__________ &nbsp;&nbsp; 岗位：__________ &nbsp;&nbsp; 姓名：__________ &nbsp;&nbsp; 得分：__________ 
        </div>
        <hr style="margin:12px 0;">
        <div id="exam-question-list">
    `;

    // 判断题
    if (judgeQuestions.length > 0) {
        html += `
        <div style="font-size:18px;font-weight:600;margin-bottom:7px;margin-top:18px;">
            一、判断题（正确打√，错误打×，每题${judgeScore}分，共${judgeTotal}分）
        </div>
    `;
        judgeQuestions.forEach((q, idx) => {
            html += `
                <div class="exam-question-block" style="margin-bottom:14px;display:flex;align-items:flex-start;">
                    <span style="display:inline-block;width:90px;">（   ）${idx + 1}、</span>
                    <span style="flex:1;font-size:18px;">${q.content}</span>
                    <button type="button" class="btn-delete" onclick="removeExamQuestionByType('judge', ${idx})" style="margin-left:22px;">删除</button>
                </div>
            `;
        });
    }

    if (singleQuestions.length > 0) {
        html += `
        <div style="font-size:18px;font-weight:600;margin-bottom:7px;margin-top:18px;">
            二、单项选择题（每题${singleScore}分，共${singleTotal}分）
        </div>
    `;
        // 单选题渲染
        singleQuestions.forEach((q, idx) => {
            html += `
                <div style="margin-bottom:22px;">
                    <div style="display:flex;align-items:center;">
                        <span style="font-weight:600;font-size:18px;margin-right:5px;">${idx + 1}、</span>
                        <span style="font-size:18px;">${q.content}<span style="margin-left:6px;">（  ）</span></span>
                        <button type="button" class="btn-delete" onclick="removeExamQuestionByType('single', ${idx})" style="margin-left:28px;">删除</button>
                    </div>
                    <div style="margin-left:38px;margin-top:5px;">
                        ${q.options.map((opt, oi) =>
                `<div style="font-size:18px;margin-bottom:4px;">
                                <b>${String.fromCharCode(65 + oi)}、</b> ${opt}
                            </div>`
            ).join('')}
                    </div>
                </div>
            `;
        });
    }

    if (judgeQuestions.length === 0 && singleQuestions.length === 0) {
        html += `<div style="color:#888;text-align:center;">（暂无题目，请先选择材料）</div>`;
    }
    html += `</div>`;

    html += `
        <div style="margin-top:48px; font-size:20px;">
            <b style="display:inline-block; width:360px; margin-left:200px;">
                阅卷人签字：<span style="border-bottom:1px dashed #888;display:inline-block;min-width:140px;">&nbsp;</span>
            </b>
            <b style="display:inline-block; width:240px; margin-left:300px;">
                日期：<span style="border-bottom:1px dashed #888;display:inline-block;min-width:140px;">&nbsp;</span>
            </b>
        </div>
    `;

    box.innerHTML = html;
}

// 删除（分类后索引删除）
window.removeExamQuestionByType = function (type, idx) {
    // 找到全局 examQuestions 中第 idx 个此类型题目
    let t = (type === 'judge') ? (q => (q.qtype === 'judge' || (!q.options || q.options.length === 2)))
        : (q => (q.qtype === 'single' || (q.options && q.options.length > 2)));
    let nth = -1;
    for (let i = 0; i < examQuestions.length; i++) {
        if (t(examQuestions[i])) {
            nth++;
            if (nth === idx) {
                examQuestions.splice(i, 1);
                break;
            }
        }
    }
    renderExamPreview();
};

// 删除题目
window.removeExamQuestion = function (idx) {
    examQuestions.splice(idx, 1);
    renderExamPreview();
};

// 试卷导出接口
function exportExamToWord() {
    const data = {
        header: document.getElementById('examHeader').value.trim(),
        title: document.getElementById('examTitle').value.trim(),
        subtitle: document.getElementById('examSubtitle').value.trim(),
        time: document.getElementById('examTime').value.trim(),
        score: document.getElementById('examScore').value.trim(),
        pass: document.getElementById('examPass').value.trim(),
        questions: examQuestions,
    };
    showToast('正在生成Word，请稍候…', false, true);
    fetch('/export_exam_docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (data.title || '试卷') + '.docx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            hideToast();
        });
}

// 替换原表单提交事件
document.getElementById('examGeneratorForm').onsubmit = function (e) {
    e.preventDefault();
    exportExamToWord();
};

