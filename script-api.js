/* ============================================================
   ALNISR Auction - API Only Version
   لا يستخدم IndexedDB - يقرأ كلشي من السيرفر
   ============================================================ */

let currentLang = localStorage.getItem('alnisrLang') || 'ar';
let currentUser = null;
let liveInterval = null;
let ws = null;
window._currentAuction = null;

// 🔧 رابط السيرفر
const BACKEND_HOST = window.location.hostname === 'localhost' 
    ? 'localhost:3000' 
    : 'alnisr-auction1.onrender.com';

const getApiUrl = () => `https://${BACKEND_HOST}/api`;
const WS_URL = () => `wss://${BACKEND_HOST}`;

// ===== اللغة =====
function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    const btn = document.querySelector('.lang-toggle');
    if (btn) btn.textContent = currentLang === 'ar' ? 'EN' : 'عربي';
    localStorage.setItem('alnisrLang', currentLang);
    updateTexts();
}

function updateTexts() {
    document.querySelectorAll('[data-ar][data-en]').forEach(el => {
        const text = currentLang === 'ar' ? el.getAttribute('data-ar') : el.getAttribute('data-en');
        if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') el.placeholder = text;
        else el.textContent = text;
    });
}

function applyLang() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    updateTexts();
}

// ===== الإشعارات =====
function showToast(msg, type = 'success', duration = 4000) {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration);
}

// ===== WebSocket =====
function initWebSocket() {
    try {
        ws = new WebSocket(WS_URL());
        ws.onopen = () => console.log('✅ متصل');
        ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
        ws.onclose = () => setTimeout(initWebSocket, 3000);
        ws.onerror = (e) => console.error('❌ خطأ:', e);
    } catch (e) { console.error(e); }
}

function handleMessage(msg) {
    const { type, ...data } = msg;
    if (type === 'BID_PLACED') {
        showToast(`💰 ${data.bidder} زايد بـ ${data.amount?.toLocaleString()}`, 'info');
        if (window.location.pathname.includes('auction')) refreshAuction();
    }
    if (type === 'NEW_MEMBER' && window.location.pathname.includes('admin')) loadMembers();
    if (type === 'USER_APPROVED') showToast('✅ تم قبول حسابك', 'success');
    if (type === 'AUCTION_STARTED') { showToast('🟢 بدأ المزاد', 'success'); refreshAuction(); }
    if (type === 'AUCTION_ENDED') { showToast('🔴 انتهى المزاد', 'info'); refreshAuction(); }
    if (type === 'NEW_AUCTION') refreshAuction();
    if (type === 'AUCTION_STATUS') refreshAuction();
    if (type === 'TIMER_UPDATE') updateTimer(data.timeRemaining);
}

function updateTimer(ms) {
    const el = document.getElementById('auction-timer-display');
    if (el) {
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if (mins < 5) el.classList.add('timer-warning');
    }
}

// ===== تسجيل الدخول =====
async function handleRegister(e) {
    e.preventDefault();
    const fullname = document.getElementById('reg-fullname')?.value?.trim();
    const phone = document.getElementById('reg-phone')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;
    
    if (!fullname || fullname.split(' ').filter(w => w).length < 3) 
        return showToast('أدخل الاسم الثلاثي كاملاً', 'error');
    if (!phone || !password || password.length < 6) 
        return showToast('كلمة السر 6 أحرف على الأقل', 'error');

    try {
        const res = await fetch(`${getApiUrl()}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, phone, password })
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.error, 'error');
        showToast('✅ تم إرسال الطلب! انتظر موافقة المشرف', 'success');
        e.target.reset();
        setTimeout(() => window.location.href = 'login.html', 1500);
    } catch (err) { showToast(err.message, 'error'); }
}

async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    try {
        const res = await fetch(`${getApiUrl()}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        const user = await res.json();
        if (!res.ok) return showToast(user.error, 'error');
        currentUser = user;
        localStorage.setItem('alnisrCurrentUser', JSON.stringify(user));
        showToast('✅ تم تسجيل الدخول!', 'success');
        setTimeout(() => window.location.href = 'auction.html', 900);
    } catch (err) { showToast(err.message, 'error'); }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('alnisrCurrentUser');
    window.location.href = 'index.html';
}

// ===== المزاد =====
async function refreshAuction() {
    try {
        const res = await fetch(`${getApiUrl()}/auctions`);
        const auctions = await res.json();
        const active = auctions.find(a => a.status === 'active') || auctions[0];
        
        if (!active) {
            document.getElementById('item-name').textContent = 'لا يوجد مزاد';
            return;
        }

        window._currentAuction = active;
        
        document.getElementById('item-name').textContent = active.itemName;
        document.getElementById('item-description').textContent = active.description || '';
        document.getElementById('start-price').textContent = (active.startPrice || 0).toLocaleString();
        document.getElementById('current-price').textContent = (active.currentPrice || 0).toLocaleString();
        document.getElementById('highest-bidder').textContent = active.highestBidder || 'لا يوجد';
        document.getElementById('auction-status').textContent = active.status === 'active' ? 'نشط 🟢' : 'منتهي 🔴';
        
        if (active.endTime) {
            const remaining = new Date(active.endTime) - new Date();
            updateTimer(Math.max(0, remaining));
        }
        
        await refreshBids();
    } catch (e) { console.error(e); }
}

async function refreshBids() {
    if (!window._currentAuction) return;
    const div = document.getElementById('bid-history');
    if (!div) return;
    
    try {
        const res = await fetch(`${getApiUrl()}/bids/${window._currentAuction._id || window._currentAuction.id}`);
        const bids = await res.json();
        if (!bids.length) { div.innerHTML = '<p class="empty-msg">لا توجد مزايدات</p>'; return; }
        
        div.innerHTML = bids.map((b, i) => `
            <div class="history-item ${i===0?'top-bid':''}">
                <div>${i===0?'🥇':i===1?'🥈':'#'+(i+1)}</div>
                <div><strong>${b.userName}</strong><small>${new Date(b.timestamp).toLocaleString()}</small></div>
                <div>${b.amount?.toLocaleString()} د.إ</div>
            </div>`
        ).join('');
    } catch (e) { console.error(e); }
}

async function placeBid() {
    if (!window._currentAuction) return showToast('لا يوجد مزاد نشط', 'error');
    if (!currentUser) return showToast('سجّل دخول أولاً', 'error');
    
    const amount = parseFloat(document.getElementById('bid-amount')?.value);
    const current = window._currentAuction.currentPrice || 0;
    
    if (!amount || amount <= current) return showToast(`أعلى من ${current}`, 'error');

    try {
        const res = await fetch(`${getApiUrl()}/bid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auctionId: window._currentAuction._id || window._currentAuction.id,
                userId: currentUser._id || currentUser.id,
                userName: currentUser.fullname,
                amount
            })
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.error, 'error');
        document.getElementById('bid-amount').value = '';
        showToast('✅ تم تقديم مزايدتك!', 'success');
        await refreshAuction();
    } catch (e) { showToast(e.message, 'error'); }
}

async function checkAuth() {
    const saved = localStorage.getItem('alnisrCurrentUser');
    if (saved) currentUser = JSON.parse(saved);
    
    const loginReq = document.getElementById('login-required');
    const content = document.getElementById('auction-content');
    const userInfo = document.getElementById('user-info');
    
    if (currentUser) {
        if (loginReq) loginReq.style.display = 'none';
        if (content) content.style.display = 'block';
        if (userInfo) userInfo.style.display = 'flex';
        document.getElementById('username').textContent = currentUser.fullname;
        await refreshAuction();
        startRefresh();
    } else {
        if (loginReq) loginReq.style.display = 'block';
        if (content) content.style.display = 'none';
    }
}

function startRefresh() {
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(refreshAuction, 3000);
}

// ===== الأدمن =====
async function loadMembers() {
    try {
        const res = await fetch(`${getApiUrl()}/admin/users`);
        const users = await res.json();
        
        const pending = users.filter(u => u.status === 'pending');
        const approved = users.filter(u => u.status === 'approved');
        
        document.getElementById('pending-count').textContent = pending.length;
        document.getElementById('active-count').textContent = approved.length;
        
        document.getElementById('pending-members').innerHTML = pending.length 
            ? pending.map(u => memberCard(u, true)).join('')
            : '<p class="empty-msg">لا توجد طلبات</p>';
        
        document.getElementById('approved-members').innerHTML = approved.length
            ? approved.map(u => memberCard(u, false)).join('')
            : '<p class="empty-msg">لا يوجد أعضاء</p>';
    } catch (e) { console.error(e); }
}

function memberCard(u, isPending) {
    return `<div class="member-card">
        <div class="member-avatar">${u.fullname?.charAt(0)}</div>
        <div class="member-info">
            <strong>${u.fullname}</strong>
            <span class="badge badge-${u.status}">${u.status}</span><br>
            <small>📞 ${u.phone}</small>
        </div>
        ${isPending ? `
            <button onclick="approveUser('${u._id}')" class="btn-success">✅ قبول</button>
            <button onclick="rejectUser('${u._id}')" class="btn-danger">❌ رفض</button>
        ` : `
            <button onclick="deleteUser('${u._id}')" class="btn-danger">🗑️ حذف</button>
        `}
    </div>`;
}

async function approveUser(id) {
    try {
        await fetch(`${getApiUrl()}/admin/approve-user/${id}`, { method: 'POST' });
        showToast('✅ تم قبول العضو', 'success');
        await loadMembers();
    } catch (e) { showToast(e.message, 'error'); }
}

async function rejectUser(id) {
    try {
        await fetch(`${getApiUrl()}/users/${id}`, { method: 'DELETE' });
        showToast('✅ تم الرفض', 'info');
        await loadMembers();
    } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUser(id) {
    if (!confirm('هل تريد حذف هذا العضو؟')) return;
    try {
        await fetch(`${getApiUrl()}/users/${id}`, { method: 'DELETE' });
        showToast('✅ تم الحذف', 'info');
        await loadMembers();
    } catch (e) { showToast(e.message, 'error'); }
}

async function createAuction(e) {
    e.preventDefault();
    const itemName = document.getElementById('auction-item-name')?.value?.trim();
    const startPrice = parseFloat(document.getElementById('auction-start-price')?.value);
    
    if (!itemName || !startPrice) return showToast('املأ جميع الحقول', 'error');
    
    try {
        const res = await fetch(`${getApiUrl()}/admin/create-auction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemName, startPrice, description: '', date: new Date().toISOString() })
        });
        if (!res.ok) return showToast('حدث خطأ', 'error');
        showToast('✅ تم إنشاء المزاد!', 'success');
        e.target.reset();
    } catch (err) { showToast(err.message, 'error'); }
}

async function startAuction() {
    if (!window._currentAuction) return showToast('لا يوجد مزاد', 'error');
    try {
        const id = window._currentAuction._id || window._currentAuction.id;
        await fetch(`${getApiUrl()}/admin/start-auction/${id}`, { method: 'POST' });
        showToast('▶ بدأ المزاد!', 'success');
        await refreshAuction();
    } catch (e) { showToast(e.message, 'error'); }
}

async function endAuction() {
    if (!window._currentAuction) return showToast('لا يوجد مزاد', 'error');
    try {
        const id = window._currentAuction._id || window._currentAuction.id;
        await fetch(`${getApiUrl()}/admin/end-auction/${id}`, { method: 'POST' });
        showToast('⏹ انتهى المزاد!', 'success');
        await refreshAuction();
    } catch (e) { showToast(e.message, 'error'); }
}

function handleAdminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password')?.value;
    if (password === 'admin2026') {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        localStorage.setItem('adminLoggedIn', '1');
        loadMembers();
        startAdminRefresh();
    } else {
        showToast('كلمة السر غير صحيحة', 'error');
    }
}

function startAdminRefresh() {
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(loadMembers, 3000);
}

// ===== التهيئة =====
window.addEventListener('DOMContentLoaded', () => {
    applyLang();
    initWebSocket();
    
    const path = window.location.pathname;
    
    if (path.includes('auction')) checkAuth();
    else if (path.includes('admin')) {
        if (localStorage.getItem('adminLoggedIn') === '1') {
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            loadMembers();
        }
    } else if (path.includes('login')) {
        const saved = localStorage.getItem('alnisrCurrentUser');
        if (saved) { currentUser = JSON.parse(saved); window.location.href = 'auction.html'; }
    }
});