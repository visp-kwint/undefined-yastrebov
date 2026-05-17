console.log('DocMind Pro loaded');

/* ==================== STATE ==================== */
let chatSessions = [];
let currentSessionId = null;
let attachedFiles = [];
let lastDocumentIds = [];
let authToken = localStorage.getItem('docmind_token') || null;
let currentUser = null;
const MAX_FILES = 5;
const TEMP_TEXTS = ['Обрабатываю...', 'Думаю...', 'Загружаю', 'Генерирую отчёт...', 'Анализирую...', 'Строю диаграмму...'];

/* ==================== DOM REFS ==================== */
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const welcomeScreen = document.getElementById('welcome-screen');
const documentsList = document.getElementById('documents-list');
const reportsPanel = document.getElementById('reports-panel');
const historyToday = document.getElementById('history-today');
const historyWeek = document.getElementById('history-week');
const historyMonth = document.getElementById('history-month');
const backendStatus = document.getElementById('backend-status');
const attachedFileInfo = document.getElementById('attached-file-info');
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const modalClose = document.getElementById('modal-close');
const regEmail = document.getElementById('reg-email');
const regPassword = document.getElementById('reg-password');
const regPassword2 = document.getElementById('reg-password2');
const registerBtn = document.getElementById('register-btn');
const regMessage = document.getElementById('reg-message');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginMessage = document.getElementById('login-message');
const profileModal = document.getElementById('profile-modal');
const userProfile = document.getElementById('user-profile');
const profileModalClose = document.getElementById('profile-modal-close');
const profileModalEmail = document.getElementById('profile-modal-email');
const profileModalId = document.getElementById('profile-modal-id');
const signOutBtn = document.getElementById('sign-out-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmClose = document.getElementById('delete-confirm-close');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const navNewDoc = document.getElementById('nav-newdoc');
const navList = document.getElementById('nav-list');
const navSearch = document.getElementById('nav-search');
const navReports = document.getElementById('nav-reports');
const toastEl = document.getElementById('toast');
const fileUploadInput = document.getElementById('file-upload-input');
const cameraInput = document.getElementById('camera-input');
const galleryInput = document.getElementById('gallery-input');

/* ==================== UTILS ==================== */
function showToast(msg, type = 'default', duration = 3000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (type !== 'default' ? ' ' + type : '');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.className = 'toast'; }, duration);
}
function setMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-message ' + type;
}
function clearMessage(el) {
    if (!el) return;
    el.textContent = '';
    el.className = 'auth-message';
}
function authHeaders() {
    return authToken ? { 'Authorization': 'Bearer ' + authToken } : {};
}
function authJsonHeaders() {
    return { 'Content-Type': 'application/json', ...authHeaders() };
}
function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML.replace(/\n/g, '<br>');
}
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
function formatDate(date) {
    return new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ==================== API ==================== */
async function checkHealth() {
    if (!backendStatus) return;
    try {
        await fetch('/api/health');
        backendStatus.innerHTML = '<span style="color:#4ade80;">● Online</span>';
    } catch {
        backendStatus.innerHTML = '<span style="color:#ff4444;">● Offline</span>';
    }
}
async function apiRegister(email, password) {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}
async function apiLogin(email, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}
async function apiGetMe() {
    try {
        const res = await fetch('/api/auth/me', { headers: authHeaders() });
        if (res.ok) return (await res.json()).user;
    } catch {}
    return null;
}
async function apiDeleteAccount() {
    try {
        const res = await fetch('/api/auth/account', { method: 'DELETE', headers: authHeaders() });
        return res.ok;
    } catch { return false; }
}
async function apiLoadSessions() {
    try {
        const res = await fetch('/api/chat/sessions', { headers: authHeaders() });
        if (res.ok) return (await res.json()).sessions || [];
    } catch {}
    return [];
}
async function apiCreateSession(title) {
    try {
        const res = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: authJsonHeaders(),
            body: JSON.stringify({ title })
        });
        if (res.ok) return (await res.json()).session;
    } catch {}
    return null;
}
async function apiSaveMessage(sessionId, sender, text, isHtml = false) {
    try {
        await fetch('/api/chat/sessions/' + sessionId + '/messages', {
            method: 'POST',
            headers: authJsonHeaders(),
            body: JSON.stringify({ sender, text, isHtml })
        });
    } catch {}
}
async function apiUpdateSessionTitle(sessionId, title) {
    try {
        await fetch('/api/chat/sessions/' + sessionId, {
            method: 'PATCH',
            headers: authJsonHeaders(),
            body: JSON.stringify({ title })
        });
    } catch {}
}
async function apiDeleteSession(sessionId) {
    try {
        await fetch('/api/chat/sessions/' + sessionId, { method: 'DELETE', headers: authHeaders() });
    } catch {}
}
async function uploadFileToBackend(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData });
        const data = await res.json();
        return { success: res.ok, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
async function loadDocumentsFromBackend() {
    try {
        const res = await fetch('/api/documents', { headers: authHeaders() });
        const data = await res.json();
        return Array.isArray(data) ? data : (data.data || data.documents || []);
    } catch { return []; }
}
async function apiAskQuestion(question, docIds) {
    try {
        const body = { question };
        if (docIds.length === 1) body.documentId = docIds[0];
        else if (docIds.length > 1) { body.documentIds = docIds; body.documentId = docIds[docIds.length - 1]; }
        const res = await fetch('/api/ask', {
            method: 'POST',
            headers: authJsonHeaders(),
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            return { success: true, answer: (data.data && data.data.answer) || data.answer || data.response || JSON.stringify(data) };
        }
        return { success: false, error: 'Сервер не смог ответить' };
    } catch (error) {
        return { success: false, error: 'Ошибка сети' };
    }
}
async function apiGenerateReport(documentId, type = 'all') {
    try {
        const res = await fetch('/api/reports/generate', {
            method: 'POST',
            headers: authJsonHeaders(),
            body: JSON.stringify({ documentId, type })
        });
        if (res.ok) {
            const data = await res.json();
            return { success: true, data: data.data || data };
        }
        return { success: false, error: 'Ошибка генерации отчёта' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
async function apiRunCommand(command, documentId, params = {}) {
    try {
        const res = await fetch('/api/commands/run', {
            method: 'POST',
            headers: authJsonHeaders(),
            body: JSON.stringify({ command, documentId, params })
        });
        if (res.ok) return { success: true, data: await res.json() };
        return { success: false, error: 'Ошибка выполнения команды' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/* ==================== AUTH ==================== */
function setLoggedIn(user, token) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('docmind_token', token);
    const de = document.getElementById('display-email');
    if (de) de.textContent = user.email;
    const up = document.getElementById('user-profile');
    if (up) up.classList.remove('hidden');
    document.body.classList.add('logged-in');
    showToast('Добро пожаловать, ' + user.email + '!', 'success');
}
function setLoggedOut() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('docmind_token');
    const up = document.getElementById('user-profile');
    if (up) up.classList.add('hidden');
    document.body.classList.remove('logged-in');
}
async function restoreSession() {
    if (!authToken) return;
    const user = await apiGetMe();
    if (user) {
        currentUser = user;
        const de = document.getElementById('display-email');
        if (de) de.textContent = user.email;
        const up = document.getElementById('user-profile');
        if (up) up.classList.remove('hidden');
        document.body.classList.add('logged-in');
        await loadSessionsFromDB();
    } else {
        setLoggedOut();
    }
}
async function loadSessionsFromDB() {
    const sessions = await apiLoadSessions();
    if (!sessions.length) return;
    chatSessions = sessions.map(s => ({
        id: s.id,
        dbId: s.id,
        title: s.title,
        messages: (s.messages || [])
            .filter(m => !TEMP_TEXTS.some(t => m.text && m.text.startsWith(t)))
            .map(m => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                isHtml: !!m.isHtml,
                time: new Date(m.createdAt)
            })),
        createdAt: new Date(s.createdAt),
        lastActivity: new Date(s.updatedAt)
    }));
    updateHistorySidebar();
}

/* ==================== FILES ==================== */
function renderAttachedFiles() {
    const info = document.getElementById('attached-file-info');
    if (!info) return;
    if (!attachedFiles.length) {
        info.classList.remove('file-visible');
        info.innerHTML = '';
        return;
    }
    info.classList.add('file-visible');
    info.innerHTML = '';
    attachedFiles.forEach((file, index) => {
        const tag = document.createElement('div');
        tag.style.cssText = 'display:flex;align-items:center;gap:6px;background:#3a3a3a;border-radius:8px;padding:5px 10px;font-size:13px;color:#c0c0c0;max-width:220px;flex-shrink:0;';
        const icon = document.createElement('span');
        icon.textContent = getFileIcon(file.name);
        icon.style.flexShrink = '0';
        const name = document.createElement('span');
        name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;';
        name.textContent = file.name;
        name.title = file.name + ' (' + formatSize(file.size) + ')';
        const del = document.createElement('button');
        del.textContent = '×';
        del.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;flex-shrink:0;';
        del.onmouseover = () => del.style.color = '#ff4444';
        del.onmouseout = () => del.style.color = '#888';
        del.addEventListener('click', () => {
            attachedFiles.splice(index, 1);
            if (fileUploadInput) fileUploadInput.value = '';
            if (cameraInput) cameraInput.value = '';
            if (galleryInput) galleryInput.value = '';
            renderAttachedFiles();
        });
        tag.appendChild(icon);
        tag.appendChild(name);
        tag.appendChild(del);
        info.appendChild(tag);
    });
    if (attachedFiles.length > 1) {
        const counter = document.createElement('div');
        counter.style.cssText = 'font-size:11px;color:#666;padding:2px 4px;align-self:center;';
        counter.textContent = attachedFiles.length + '/' + MAX_FILES;
        info.appendChild(counter);
    }
}
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: '📕', docx: '📘', doc: '📘', xlsx: '📗', xls: '📗', csv: '📗',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', txt: '📄'
    };
    return icons[ext] || '📎';
}
function clearAttachedFiles() {
    attachedFiles = [];
    if (fileUploadInput) fileUploadInput.value = '';
    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';
    renderAttachedFiles();
}
function addFilesToList(files) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    let added = 0;
    for (const file of arr) {
        if (attachedFiles.length >= MAX_FILES) {
            showToast('Максимум ' + MAX_FILES + ' файлов', 'error');
            break;
        }
        const isDup = attachedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDup) { attachedFiles.push(file); added++; }
    }
    if (added > 0) renderAttachedFiles();
}

/* ==================== FILE INPUTS ==================== */
const attachBtnEl = document.getElementById('attach-btn');
if (attachBtnEl && fileUploadInput) {
    fileUploadInput.multiple = true;
    attachBtnEl.addEventListener('click', () => { fileUploadInput.value = ''; fileUploadInput.click(); });
    fileUploadInput.addEventListener('change', e => addFilesToList(e.target.files));
}
const scanBtnEl = document.getElementById('scan-btn');
if (scanBtnEl && cameraInput) {
    scanBtnEl.addEventListener('click', () => { cameraInput.value = ''; cameraInput.click(); });
    cameraInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) { addFilesToList([file]); autoUploadFromCamera(file); }
    });
}
const photoBtnEl = document.getElementById('photo-btn');
if (photoBtnEl && galleryInput) {
    galleryInput.multiple = true;
    photoBtnEl.addEventListener('click', () => { galleryInput.value = ''; galleryInput.click(); });
    galleryInput.addEventListener('change', e => addFilesToList(e.target.files));
}

/* ==================== MESSAGES ==================== */
function addTempAiMessage(text) {
    if (!chatMessages) return;
    const message = { id: 'temp_' + Date.now(), sender: 'ai', text, isHtml: false, time: new Date() };
    renderMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeLastAiMessage() {
    if (!chatMessages) return;
    const msgs = chatMessages.querySelectorAll('.message.ai');
    if (msgs.length) msgs[msgs.length - 1].remove();
}

async function autoUploadFromCamera(file) {
    attachedFiles = attachedFiles.filter(f => !(f.name === file.name && f.size === file.size));
    renderAttachedFiles();
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (documentsList) documentsList.classList.add('hidden');
    if (reportsPanel) reportsPanel.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');
    await addMessageToSession('user', '📎 ' + file.name);
    addTempAiMessage('Загружаю...');
    const result = await uploadFileToBackend(file);
    removeLastAiMessage();
    if (result.success) {
        const d = result.data;
        if (d.id) {
            lastDocumentIds.push(d.id);
            lastDocumentIds = [...new Set(lastDocumentIds)];
        }
        await addMessageToSession('ai',
            '"' + file.name + '" загружен!\n' +
            (d.extractedText ? 'Задайте вопрос по документу или выберите команду слева!' : '⚠️ Текст не удалось извлечь.')
        );
    } else {
        await addMessageToSession('ai', '❌ Ошибка: ' + (result.data?.error || result.error || 'неизвестная'));
    }
}

/* ==================== CHAT LOGIC ==================== */
async function sendMessage() {
    const files = [...attachedFiles];
    const text = chatInput ? chatInput.value.trim() : '';
    const hasFiles = files.length > 0;
    if (!text && !hasFiles) return;

    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (documentsList) documentsList.classList.add('hidden');
    if (reportsPanel) reportsPanel.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');
    if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }

    attachedFiles = [];
    renderAttachedFiles();
    if (fileUploadInput) fileUploadInput.value = '';
    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';

    if (hasFiles) {
        const fileNames = files.map(f => '(' + f.name + ')').join(', ');
        const userText = text ? text + '\n' + fileNames : fileNames;
        await addMessageToSession('user', userText);
        addTempAiMessage('Обрабатываю...');
        const newIds = [];
        for (const file of files) {
            const result = await uploadFileToBackend(file);
            if (result.success && result.data.id) newIds.push(result.data.id);
        }
        removeLastAiMessage();
        if (!newIds.length) {
            await addMessageToSession('ai', '❌ Не удалось загрузить файлы.');
            return;
        }
        lastDocumentIds.push(...newIds);
        lastDocumentIds = [...new Set(lastDocumentIds)];
        if (text) {
            await routeAiRequest(text, lastDocumentIds);
        } else {
            await addMessageToSession('ai',
                '' + (files.length > 1 ? files.length + ' файла загружено' : '"' + files[0].name + '" загружен') +
                '\nЗадайте вопрос по документу или выберите команду слева!'
            );
        }
    } else {
        await addMessageToSession('user', text);
        await routeAiRequest(text, lastDocumentIds);
    }
}

/* ==================== AI ROUTING ==================== */
async function routeAiRequest(text, docIds) {
    const lower = text.toLowerCase();
    if (lower.includes('отчёт') || lower.includes('отчет') || lower.includes('report')) {
        await askReport(text, docIds);
    } else if (lower.includes('диаграмма') || lower.includes('график') || lower.includes('chart')) {
        await askChart(text, docIds);
    } else if (lower.includes('сводка') || lower.includes('summary') || lower.includes('анализ')) {
        await askSummary(text, docIds);
    } else if (lower.includes('excel') || lower.includes('эксель')) {
        await askExport(text, docIds, 'excel');
    } else if (lower.includes('pdf')) {
        await askExport(text, docIds, 'pdf');
    } else {
        await askYandex(text, docIds);
    }
}

/* ==================== COMMANDS ==================== */
async function executeCommand(command, params = {}) {
    const documentId = lastDocumentIds.length ? lastDocumentIds[lastDocumentIds.length - 1] : null;
    if (!documentId) {
        showToast('Сначала загрузите документ', 'error');
        return;
    }

    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (documentsList) documentsList.classList.add('hidden');
    if (reportsPanel) reportsPanel.classList.add('hidden');
    if (chatMessages) chatMessages.classList.remove('hidden');

    const commandLabels = {
        analyze: '🔍 Анализ документа',
        summary: '📝 Краткое содержание',
        report: '📈 Генерация отчёта',
        chart: '📉 Построение диаграммы',
        excel: '📗 Экспорт в Excel',
        pdf: '📕 Экспорт в PDF',
        compare: '⚖️ Сравнение документов',
        extract: '🔢 Извлечение таблиц',
        salary: '💰 Расчёт зарплаты',
        tax: '🏛️ Налоговый расчёт',
        balance: '⚖️ Баланс проводок',
        audit: '🔍 Аудит документа'
    };

    await addMessageToSession('user', commandLabels[command] || command);
    addTempAiMessage('Выполняю команду...');

    const result = await apiRunCommand(command, documentId, params);
    removeLastAiMessage();

    if (result.success) {
        const data = result.data;
        if (data.html) {
            await addMessageToSession('ai', data.html, true);
        } else if (data.text) {
            await addMessageToSession('ai', data.text);
        } else {
            await addMessageToSession('ai', '✅ Команда выполнена успешно.');
        }
    } else {
        await addMessageToSession('ai', '❌ ' + (result.error || 'Ошибка выполнения команды'));
    }
}

/* ==================== REPORTS ==================== */
async function askReport(question, docIds) {
    addTempAiMessage('Генерирую отчёт...');
    try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) {
            removeLastAiMessage();
            await addMessageToSession('ai', '❌ Нет загруженных документов для генерации отчёта.');
            return;
        }
        const reportData = await apiGenerateReport(documentId, 'all');
        removeLastAiMessage();
        if (reportData.success) {
            const reportHtml = renderReport(reportData.data);
            await addMessageToSession('ai', reportHtml, true);
        } else {
            await addMessageToSession('ai', '❌ ' + (reportData.error || 'Не удалось сгенерировать отчёт.'));
        }
    } catch (error) {
        console.error('askReport error:', error);
        removeLastAiMessage();
        await addMessageToSession('ai', '❌ Ошибка при генерации отчёта.');
    }
}

async function askChart(question, docIds) {
    addTempAiMessage('Строю диаграмму...');
    try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) {
            removeLastAiMessage();
            await addMessageToSession('ai', '❌ Нет загруженных документов.');
            return;
        }
        const reportData = await apiGenerateReport(documentId, 'charts');
        removeLastAiMessage();
        if (reportData.success) {
            const reportHtml = renderReport(reportData.data);
            await addMessageToSession('ai', reportHtml, true);
        } else {
            await addMessageToSession('ai', '❌ ' + (reportData.error || 'Не удалось построить диаграмму.'));
        }
    } catch (error) {
        removeLastAiMessage();
        await addMessageToSession('ai', '❌ Ошибка.');
    }
}

async function askSummary(question, docIds) {
    addTempAiMessage('Анализирую...');
    try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) {
            removeLastAiMessage();
            await addMessageToSession('ai', '❌ Нет загруженных документов.');
            return;
        }
        const result = await apiAskQuestion('Сделай краткое содержание и выдели ключевые цифры, таблицы, даты', [documentId]);
        removeLastAiMessage();
        if (result.success) {
            await addMessageToSession('ai', result.answer);
        } else {
            await addMessageToSession('ai', '❌ ' + result.error);
        }
    } catch (error) {
        removeLastAiMessage();
        await addMessageToSession('ai', '❌ Ошибка.');
    }
}

async function askExport(question, docIds, type) {
    addTempAiMessage('Генерирую файл...');
    try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) {
            removeLastAiMessage();
            await addMessageToSession('ai', '❌ Нет загруженных документов.');
            return;
        }
        const reportData = await apiGenerateReport(documentId, type);
        removeLastAiMessage();
        if (reportData.success) {
            const reportHtml = renderReport(reportData.data);
            await addMessageToSession('ai', reportHtml, true);
        } else {
            await addMessageToSession('ai', '❌ ' + (reportData.error || 'Не удалось создать файл.'));
        }
    } catch (error) {
        removeLastAiMessage();
        await addMessageToSession('ai', '❌ Ошибка.');
    }
}

/* ==================== YANDEX AI ==================== */
async function askYandex(question, docIds) {
    addTempAiMessage('Думаю...');
    try {
        const result = await apiAskQuestion(question, docIds);
        removeLastAiMessage();
        if (result.success) {
            await addMessageToSession('ai', result.answer);
        } else {
            await addMessageToSession('ai', '❌ ' + result.error);
        }
    } catch (error) {
        console.error('askYandex error:', error);
        removeLastAiMessage();
        await addMessageToSession('ai', '❌ Ошибка сети: сервер не отвечает.');
    }
}

/* ==================== SESSIONS ==================== */
async function createNewSession(firstMessage) {
    const title = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? '...' : '');
    const session = {
        id: 'local_' + Date.now(),
        dbId: null,
        title,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date()
    };
    if (authToken) {
        const dbSession = await apiCreateSession(title);
        if (dbSession) { session.id = dbSession.id; session.dbId = dbSession.id; }
    }
    chatSessions.push(session);
    currentSessionId = session.id;
    return session;
}
function getCurrentSession() {
    return chatSessions.find(s => s.id === currentSessionId);
}

/* ==================== addMessageToSession ==================== */
async function addMessageToSession(sender, text, isHtml = false) {
    let session = getCurrentSession();
    if (!session) session = await createNewSession(text);
    const message = { id: Date.now() + Math.random(), sender, text, isHtml, time: new Date() };
    session.messages.push(message);
    session.lastActivity = new Date();
    const userMsgs = session.messages.filter(m => m.sender === 'user');
    if (userMsgs.length === 1 && sender === 'user') {
        session.title = text.substring(0, 40) + (text.length > 40 ? '...' : '');
        if (session.dbId) apiUpdateSessionTitle(session.dbId, session.title);
    }
    const isTemp = TEMP_TEXTS.some(t => text && text.startsWith(t));
    if (session.dbId && authToken && !isTemp) {
        await apiSaveMessage(session.dbId, sender, text, isHtml);
    }
    renderMessage(message);
    updateHistorySidebar();
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    return message;
}

/* ==================== RENDER MESSAGE ==================== */
function renderMessage(message) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = 'message ' + message.sender;
    const avatar = message.sender === 'user' ? 'Вы' : 'AI';
    const t = message.time instanceof Date ? message.time : new Date(message.time);
    const timeStr = t.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.textContent = avatar;

    const content = document.createElement('div');
    content.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (message.isHtml) {
        bubble.innerHTML = message.text;
    } else {
        bubble.innerHTML = escapeHtml(message.text);
    }

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = timeStr;

    if (message.sender === 'ai') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Скопировать';
        copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        copyBtn.addEventListener('click', () => {
            const copyText = message.isHtml ? bubble.innerText : message.text;
            navigator.clipboard.writeText(copyText).then(() => {
                copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                }, 2000);
            }).catch(() => showToast('Не удалось скопировать', 'error'));
        });
        meta.appendChild(copyBtn);
        meta.appendChild(timeEl);
    } else {
        meta.appendChild(timeEl);
    }

    content.appendChild(bubble);
    content.appendChild(meta);
    div.appendChild(avatarEl);
    div.appendChild(content);
    chatMessages.appendChild(div);
}

/* ==================== SESSION NAVIGATION ==================== */
function loadSession(sessionId) {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;
    currentSessionId = sessionId;
    lastDocumentIds = [];
    clearAttachedFiles();
    if (chatMessages) {
        chatMessages.innerHTML = '';
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (documentsList) documentsList.classList.add('hidden');
        if (reportsPanel) reportsPanel.classList.add('hidden');
        chatMessages.classList.remove('hidden');
        session.messages.forEach(msg => renderMessage(msg));
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    if (chatInput) chatInput.focus();
}

/* ==================== HISTORY SIDEBAR ==================== */
function updateHistorySidebar() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);
    const t = [], w = [], m = [];
    chatSessions.forEach(s => {
        const d = new Date(s.lastActivity);
        const item = { id: s.id, dbId: s.dbId, title: s.title, time: d };
        if (d >= today) t.push(item);
        else if (d >= weekAgo) w.push(item);
        else if (d >= monthAgo) m.push(item);
    });
    if (historyToday) renderHistorySection(historyToday, t);
    if (historyWeek) renderHistorySection(historyWeek, w);
    if (historyMonth) renderHistorySection(historyMonth, m);
}
function renderHistorySection(container, items) {
    container.innerHTML = '';
    [...items].reverse().forEach(item => {
        const wrap = document.createElement('div');
        wrap.className = 'history-item';
        const title = document.createElement('span');
        title.className = 'history-item-title';
        title.textContent = item.title;
        title.title = new Date(item.time).toLocaleString('ru-RU');
        title.addEventListener('click', () => loadSession(item.id));
        const del = document.createElement('button');
        del.className = 'history-item-del';
        del.textContent = '×';
        del.title = 'Удалить';
        del.addEventListener('click', async e => {
            e.stopPropagation();
            if (item.dbId && authToken) await apiDeleteSession(item.dbId);
            chatSessions = chatSessions.filter(s => s.id !== item.id);
            if (currentSessionId === item.id) {
                currentSessionId = null;
                lastDocumentIds = [];
                if (chatMessages) { chatMessages.innerHTML = ''; chatMessages.classList.add('hidden'); }
                if (welcomeScreen) welcomeScreen.classList.remove('hidden');
            }
            updateHistorySidebar();
        });
        wrap.appendChild(title);
        wrap.appendChild(del);
        container.appendChild(wrap);
    });
}

/* ==================== COMMAND PANEL ==================== */
document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        if (cmd) executeCommand(cmd);
    });
});

document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action) executeCommand(action);
    });
});

function triggerUpload() {
    if (fileUploadInput) fileUploadInput.click();
}

function sendQuickCommand(cmd) {
    executeCommand(cmd);
}

/* ==================== MODALS & AUTH UI ==================== */
document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + target).classList.add('active');
        clearMessage(regMessage);
        clearMessage(loginMessage);
    });
});

if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
        const email = regEmail.value.trim();
        const pass = regPassword.value;
        const pass2 = regPassword2.value;
        clearMessage(regMessage);
        if (!email || !pass || !pass2) { setMessage(regMessage, 'Заполните все поля', 'error'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage(regMessage, 'Введите корректный email', 'error'); return; }
        if (pass.length < 4) { setMessage(regMessage, 'Пароль минимум 4 символа', 'error'); return; }
        if (pass !== pass2) { setMessage(regMessage, 'Пароли не совпадают', 'error'); return; }
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span class="btn-spinner"></span>Регистрация...';
        const result = await apiRegister(email, pass);
        registerBtn.disabled = false;
        registerBtn.textContent = 'Зарегистрироваться';
        if (result.ok) {
            setMessage(regMessage, 'Аккаунт создан!', 'success');
            setLoggedIn(result.data.user, result.data.token);
            await loadSessionsFromDB();
            setTimeout(() => {
                loginModal.classList.add('hidden');
                resetRegForm();
            }, 800);
        } else {
            const msg = result.data.error || 'Ошибка регистрации';
            setMessage(regMessage, '' + msg + (result.status === 409 ? ' — войдите во вкладке "Вход"' : ''), 'error');
        }
    });
}
function resetRegForm() {
    if (regEmail) regEmail.value = '';
    if (regPassword) regPassword.value = '';
    if (regPassword2) regPassword2.value = '';
    clearMessage(regMessage);
}
if (regEmail) regEmail.addEventListener('keydown', e => { if (e.key === 'Enter') regPassword.focus(); });
if (regPassword) regPassword.addEventListener('keydown', e => { if (e.key === 'Enter') regPassword2.focus(); });
if (regPassword2) regPassword2.addEventListener('keydown', e => { if (e.key === 'Enter') registerBtn.click(); });

if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const pass = loginPassword.value;
        clearMessage(loginMessage);
        if (!email || !pass) { setMessage(loginMessage, 'Введите email и пароль', 'error'); return; }
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="btn-spinner"></span>Входим...';
        const result = await apiLogin(email, pass);
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Войти';
        if (result.ok) {
            setMessage(loginMessage, 'Вход выполнен!', 'success');
            setLoggedIn(result.data.user, result.data.token);
            await loadSessionsFromDB();
            setTimeout(() => {
                loginModal.classList.add('hidden');
                loginEmail.value = '';
                loginPassword.value = '';
                clearMessage(loginMessage);
            }, 600);
        } else {
            setMessage(loginMessage, '' + (result.data.error || 'Неверный email или пароль'), 'error');
        }
    });
}
if (loginEmail) loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') loginPassword.focus(); });
if (loginPassword) loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') loginSubmitBtn.click(); });

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        loginModal.classList.remove('hidden');
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="register"]').classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-register').classList.add('active');
        clearMessage(regMessage);
        clearMessage(loginMessage);
        setTimeout(() => regEmail && regEmail.focus(), 100);
    });
}
if (modalClose) modalClose.addEventListener('click', () => loginModal.classList.add('hidden'));
if (loginModal) loginModal.addEventListener('click', e => { if (e.target === loginModal) loginModal.classList.add('hidden'); });

if (userProfile) {
    userProfile.addEventListener('click', () => {
        if (!currentUser) return;
        if (profileModalEmail) profileModalEmail.textContent = currentUser.email;
        if (profileModalId) profileModalId.textContent = 'ID: ' + currentUser.id;
        profileModal.classList.remove('hidden');
    });
}
if (profileModalClose) profileModalClose.addEventListener('click', () => profileModal.classList.add('hidden'));
if (profileModal) profileModal.addEventListener('click', e => { if (e.target === profileModal) profileModal.classList.add('hidden'); });
if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
        setLoggedOut();
        chatSessions = []; currentSessionId = null; lastDocumentIds = [];
        clearAttachedFiles();
        if (chatMessages) { chatMessages.innerHTML = ''; chatMessages.classList.add('hidden'); }
        if (documentsList) documentsList.classList.add('hidden');
        if (reportsPanel) reportsPanel.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        updateHistorySidebar();
        profileModal.classList.add('hidden');
        showToast('Вы вышли из аккаунта');
    });
}

if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => { profileModal.classList.add('hidden'); deleteConfirmModal.classList.remove('hidden'); });
if (deleteConfirmClose) deleteConfirmClose.addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));
if (deleteConfirmModal) deleteConfirmModal.addEventListener('click', e => { if (e.target === deleteConfirmModal) deleteConfirmModal.classList.add('hidden'); });
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<span class="btn-spinner"></span>Удаление...';
        const ok = await apiDeleteAccount();
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Удалить';
        if (ok) {
            setLoggedOut();
            deleteConfirmModal.classList.add('hidden');
            chatSessions = []; currentSessionId = null; lastDocumentIds = [];
            clearAttachedFiles();
            if (chatMessages) { chatMessages.innerHTML = ''; chatMessages.classList.add('hidden'); }
            if (documentsList) documentsList.classList.add('hidden');
            if (reportsPanel) reportsPanel.classList.add('hidden');
            if (welcomeScreen) welcomeScreen.classList.remove('hidden');
            updateHistorySidebar();
            showToast('Аккаунт удалён', 'error');
        } else {
            showToast('Ошибка удаления аккаунта', 'error');
            deleteConfirmModal.classList.add('hidden');
        }
    });
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (loginModal) loginModal.classList.add('hidden');
        if (profileModal) profileModal.classList.add('hidden');
        if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
    }
});

/* ==================== INPUT & NAV ==================== */
if (chatInput) {
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        this.style.overflowY = this.scrollHeight > 200 ? 'auto' : 'hidden';
    });
}

if (navNewDoc) {
    navNewDoc.addEventListener('click', () => {
        currentSessionId = null; lastDocumentIds = [];
        clearAttachedFiles();
        if (chatMessages) { chatMessages.innerHTML = ''; chatMessages.classList.add('hidden'); }
        if (documentsList) documentsList.classList.add('hidden');
        if (reportsPanel) reportsPanel.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (chatInput) chatInput.focus();
    });
}
if (navList) {
    navList.addEventListener('click', async () => {
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (chatMessages) chatMessages.classList.add('hidden');
        if (reportsPanel) reportsPanel.classList.add('hidden');
        if (documentsList) {
            documentsList.classList.remove('hidden');
            documentsList.innerHTML = '<div class="message ai"><div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">⏳ Загружаю документы...</div></div></div>';
        }
        const docs = await loadDocumentsFromBackend();
        if (documentsList) documentsList.innerHTML = '';
        if (!docs.length) {
            if (documentsList) documentsList.innerHTML = '<div class="message ai"><div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">📭 Документов нет. Загрузите через 📎</div></div></div>';
            return;
        }
        if (documentsList) {
            const header = document.createElement('div');
            header.className = 'message ai';
            header.innerHTML = '<div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">📋 <b>Документы (' + docs.length + '):</b></div></div>';
            documentsList.appendChild(header);
            docs.forEach((doc, i) => {
                const d = document.createElement('div');
                d.className = 'message ai';
                const name = doc.originalName || doc.filename || 'Документ ' + (i + 1);
                const size = doc.size ? formatSize(doc.size) : '';
                const date = doc.createdAt ? formatDate(doc.createdAt) : '';
                const status = doc.status || '';
                const icon = getFileIcon(name);
                d.innerHTML =
                    '<div class="message-avatar">' + (i + 1) + '</div>' +
                    '<div class="message-content"><div class="message-bubble">' +
                    icon + ' <b>' + escapeHtml(name) + '</b>' +
                    (size ? '<br>📦 ' + size : '') +
                    (status ? '<br>📊 ' + status : '') +
                    (date ? '<br>📅 ' + date : '') +
                    '<br><div class="doc-preview-actions" style="margin-top:10px;">' +
                    '<button class="doc-action" data-doc-id="' + doc.id + '" data-action="ask">💬 Вопрос</button>' +
                    '<button class="doc-action" data-doc-id="' + doc.id + '" data-action="report">📈 Отчёт</button>' +
                    '<button class="doc-action" data-doc-id="' + doc.id + '" data-action="analyze">🔍 Анализ</button>' +
                    '</div></div></div>';
                documentsList.appendChild(d);
            });
            documentsList.querySelectorAll('.doc-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const docId = btn.dataset.docId;
                    const action = btn.dataset.action;
                    lastDocumentIds = [docId];
                    currentSessionId = null;
                    if (chatMessages) { chatMessages.innerHTML = ''; chatMessages.classList.remove('hidden'); }
                    if (documentsList) documentsList.classList.add('hidden');
                    if (welcomeScreen) welcomeScreen.classList.add('hidden');
                    if (action === 'ask') {
                        addMessageToSession('ai', 'Выбран документ. Задайте вопрос по содержимому.');
                    } else {
                        executeCommand(action);
                    }
                    if (chatInput) chatInput.focus();
                });
            });
        }
    });
}
if (navSearch) {
    navSearch.addEventListener('click', () => {
        const query = prompt('Поисковый запрос:');
        if (!query) return;
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (documentsList) documentsList.classList.add('hidden');
        if (reportsPanel) reportsPanel.classList.add('hidden');
        if (chatMessages) chatMessages.classList.remove('hidden');
        currentSessionId = null;
        if (chatMessages) chatMessages.innerHTML = '';
        addMessageToSession('user', '🔍 ' + query);
        fetch('/api/documents/search?q=' + encodeURIComponent(query), { headers: authHeaders() })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => {
                const results = Array.isArray(data) ? data : (data.results || []);
                if (results.length) {
                    let txt = 'Найдено ' + results.length + ':\n\n';
                    results.forEach((r, i) => { txt += (i + 1) + '. ' + (r.originalName || r.name) + '\n'; });
                    addMessageToSession('ai', txt);
                } else {
                    addMessageToSession('ai', 'Ничего не найдено по "' + query + '"');
                }
            })
            .catch(() => addMessageToSession('ai', 'Поиск пока не реализован.'));
    });
}
if (navReports) {
    navReports.addEventListener('click', async () => {
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (chatMessages) chatMessages.classList.add('hidden');
        if (documentsList) documentsList.classList.add('hidden');
        if (reportsPanel) {
            reportsPanel.classList.remove('hidden');
            reportsPanel.innerHTML = '<div class="message ai"><div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">⏳ Загружаю отчёты...</div></div></div>';
        }
        try {
            const res = await fetch('/api/reports', { headers: authHeaders() });
            const data = await res.json();
            const reports = data.reports || [];
            if (reportsPanel) {
                reportsPanel.innerHTML = '';
                if (!reports.length) {
                    reportsPanel.innerHTML = '<div class="message ai"><div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">📭 Отчётов пока нет. Загрузите документ и создайте отчёт!</div></div></div>';
                    return;
                }
                const header = document.createElement('div');
                header.className = 'message ai';
                header.innerHTML = '<div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">📊 <b>Ваши отчёты (' + reports.length + '):</b></div></div></div>';
                reportsPanel.appendChild(header);
                reports.forEach((report, i) => {
                    const r = document.createElement('div');
                    r.className = 'message ai';
                    r.innerHTML = '<div class="message-avatar">' + (i + 1) + '</div><div class="message-content"><div class="message-bubble">' +
                        '<b>' + escapeHtml(report.title || 'Отчёт') + '</b><br>' +
                        '📄 ' + (report.type || 'отчёт').toUpperCase() + '<br>' +
                        '📅 ' + formatDate(report.createdAt) + '<br>' +
                        (report.fileUrl ? '<a href="' + report.fileUrl + '" download class="report-file-link" style="margin-top:8px;display:inline-flex;"><span>📥</span> Скачать</a>' : '') +
                        '</div></div>';
                    reportsPanel.appendChild(r);
                });
            }
        } catch {
            if (reportsPanel) reportsPanel.innerHTML = '<div class="message ai"><div class="message-avatar">AI</div><div class="message-content"><div class="message-bubble">❌ Ошибка загрузки отчётов</div></div></div>';
        }
    });
}

if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (chatInput) {
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

/* ==================== BURGER MENU ==================== */
const burgerBtn = document.getElementById('burger-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (burgerBtn) {
    burgerBtn.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
}
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeSidebar();
    });
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
});

let touchStartX = 0;
if (sidebar) {
    sidebar.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    sidebar.addEventListener('touchend', e => {
        if (e.changedTouches[0].clientX - touchStartX < -60) closeSidebar();
    }, { passive: true });
}
document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });
document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (touchStartX < 30 && dx > 60 && window.innerWidth <= 768) openSidebar();
}, { passive: true });

/* ==================== INIT ==================== */
checkHealth();
setInterval(checkHealth, 30000);
restoreSession();
if (chatInput) chatInput.focus();