/* ============================================================
   قاعدة البيانات IndexedDB
   ============================================================ */
const DB_NAME = 'AlnisrDB';
const DB_VERSION = 2;
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('users')) {
                const us = d.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                us.createIndex('phone', 'phone', { unique: true });
                us.createIndex('status', 'status', { unique: false });
            }
            if (!d.objectStoreNames.contains('auctions')) {
                const as = d.createObjectStore('auctions', { keyPath: 'id', autoIncrement: true });
                as.createIndex('status', 'status', { unique: false });
            }
            if (!d.objectStoreNames.contains('bids')) {
                const bs = d.createObjectStore('bids', { keyPath: 'id', autoIncrement: true });
                bs.createIndex('auctionId', 'auctionId', { unique: false });
                bs.createIndex('userId', 'userId', { unique: false });
            }
            if (!d.objectStoreNames.contains('settings')) {
                d.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!d.objectStoreNames.contains('notifications')) {
                const ns = d.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
                ns.createIndex('userId', 'userId', { unique: false });
                ns.createIndex('read', 'read', { unique: false });
            }
        };
        req.onsuccess = (e) => { db = e.target.result; resolve(db); };
        req.onerror  = (e) => reject(e.target.error);
    });
}

const dbGet    = (s, k) => new Promise((res, rej) => { const tx = db.transaction(s,'readonly'); const r = tx.objectStore(s).get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const dbGetAll = (s)    => new Promise((res, rej) => { const tx = db.transaction(s,'readonly'); const r = tx.objectStore(s).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const dbAdd    = (s, d) => new Promise((res, rej) => { const tx = db.transaction(s,'readwrite'); const r = tx.objectStore(s).add(d); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const dbPut    = (s, d) => new Promise((res, rej) => { const tx = db.transaction(s,'readwrite'); const r = tx.objectStore(s).put(d); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const dbDelete = (s, k) => new Promise((res, rej) => { const tx = db.transaction(s,'readwrite'); const r = tx.objectStore(s).delete(k); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
const dbGetByIndex = (s, idx, val) => new Promise((res, rej) => { const tx = db.transaction(s,'readonly'); const r = tx.objectStore(s).index(idx).getAll(val); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });

/* ============================================================
   BroadcastChannel - مشاركة البيانات بين التبويبات فورياً
   ============================================================ */
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('alnisr_channel') : null;

function broadcast(type, data = {}) {
    if (bc) bc.postMessage({ type, data, ts: Date.now() });
}

if (bc) {
    bc.onmessage = async (e) => {
        const { type } = e.data;
        if (type === 'BID_PLACED' || type === 'AUCTION_STATUS') {
            if (window.location.pathname.includes('auction.html')) await refreshAuction();
            if (window.location.pathname.includes('admin.html'))  await refreshAdminCurrentAuction();
        }
        if (type === 'NEW_MEMBER') {
            if (window.location.pathname.includes('admin.html')) await loadMembersData();
        }
    };
}

/* ============================================================
   WebSocket - الاتصال بالخادم للتحديثات الفورية
   ============================================================ */
let ws = null;

// 🔧 تحديد رابط Backend الصحيح
const getBackendHost = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'localhost:3000';
    }
    // في الإنتاج: استخدم رابط Render الخاص بك
    return 'alnisr-auction1.onrender.com'; // 📝 رابط Render هنا
};

const BACKEND_HOST = getBackendHost();

function getApiUrl() {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `//${BACKEND_HOST}/api`;
}

const WS_URL = (() => {
    if (window.location.protocol === 'https:') {
        return `wss://${BACKEND_HOST}`;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://localhost:3000`;
    } else {
        return `wss://${BACKEND_HOST}`;
    }
})();

console.log('🔗 WebSocket URL:', WS_URL);

function initWebSocket() {
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('✅ متصل بالخادم');
            showToast(currentLang==='ar'?'✅ متصل بالخادم':'✅ Connected to server','success', 2000);
        };
        
        ws.onmessage = async (e) => {
            const msg = JSON.parse(e.data);
            await handleServerMessage(msg);
        };
        
        ws.onerror = (error) => {
            console.error('❌ خطأ الاتصال:', error);
            showToast(currentLang==='ar'?'❌ خطأ في الاتصال':'❌ Connection error','error', 3000);
        };
        
        ws.onclose = () => {
            console.log('❌ قطع الاتصال');
            setTimeout(initWebSocket, 3000);
        };
    } catch (error) {
        console.error('WebSocket Error:', error);
    }
}

async function handleServerMessage(msg) {
    const { type, data } = msg;
    
    switch(type) {
        case 'BID_PLACED':
            if (window.location.pathname.includes('auction.html')) {
                await refreshAuction();
                showToast(`💰 ${data.bidder} زايد بـ ${data.amount.toLocaleString()}`, 'info', 3000);
            }
            if (window.location.pathname.includes('admin.html')) {
                await refreshAdminCurrentAuction();
            }
            break;
            
        case 'NEW_MEMBER':
            if (window.location.pathname.includes('admin.html')) {
                await loadMembersData();
                showToast(currentLang==='ar'?'👤 عضو جديد':'👤 New member','info', 2000);
            }
            break;
            
        case 'USER_APPROVED':
            showToast(currentLang==='ar'?'✅ تم قبول حسابك':'✅ Account approved','success', 3000);
            break;
            
        case 'AUCTION_STARTED':
            if (window.location.pathname.includes('auction.html')) {
                await refreshAuction();
                showToast(currentLang==='ar'?'🟢 بدأ المزاد':'🟢 Auction started','success', 3000);
            }
            break;
            
        case 'AUCTION_ENDED':
            if (window.location.pathname.includes('auction.html')) {
                await refreshAuction();
                showToast(currentLang==='ar'?'🔴 انتهى المزاد':'🔴 Auction ended','info', 3000);
            }
            break;
            
        case 'TIMER_UPDATE':
            updateAuctionTimer(data.timeRemaining, data.endTime);
            break;
            
        case 'AUCTION_EXTENDED':
            showToast(currentLang==='ar'?'⏰ تم تمديد المزاد':'⏰ Auction extended','info', 3000);
            break;
            
        case 'NEW_MESSAGE':
            if (window.location.pathname.includes('chat')) {
                await loadChatMessages();
            }
            break;
    }
}

function updateAuctionTimer(timeRemaining, endTime) {
    const timerEl = document.getElementById('auction-timer');
    if (!timerEl) return;
    
    if (typeof timeRemaining === 'object' && timeRemaining._seconds) {
        timeRemaining = timeRemaining._seconds * 1000;
    }
    
    const timer = document.getElementById('auction-timer-display');
    if (timer) {
        const mins = Math.floor(timeRemaining / 60000);
        const secs = Math.floor((timeRemaining % 60000) / 1000);
        timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (mins < 5) {
            timer.classList.add('timer-warning');
        } else {
            timer.classList.remove('timer-warning');
        }
    }
}

function sendServerMessage(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}

/* ============================================================
   نظام Polling - مزامنة بين الأجهزة المختلفة (بدون انترنت)
   ============================================================ */
let lastDataHash = null;
let pollInterval = null;

function hashData(obj) {
    return JSON.stringify(obj).split('').reduce((a,b) => {a = ((a<<5)-a)+b.charCodeAt(0); return a&a;}, 0).toString();
}

async function checkRemoteUpdates() {
    try {
        const auctions = await dbGetAll('auctions');
        const users = await dbGetAll('users');
        const bids = await dbGetAll('bids');
        const currentHash = hashData({ auctions, users, bids });
        
        if (lastDataHash && lastDataHash !== currentHash) {
            const path = window.location.pathname;
            if (path.includes('auction.html')) await refreshAuction();
            if (path.includes('admin.html')) {
                await loadMembersData();
                await refreshAdminCurrentAuction();
            }
            if (path.includes('profile.html')) await loadMemberProfile();
        }
        lastDataHash = currentHash;
    } catch (e) {
        console.error('Polling error:', e);
    }
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(checkRemoteUpdates, 2000);
}

function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
}

if (typeof window !== 'undefined') {
    window.addEventListener('focus', startPolling);
    window.addEventListener('blur', stopPolling);
}

/* ============================================================
   الحالة العامة
   ============================================================ */
let currentLang = localStorage.getItem('alnisrLang') || 'ar';
let currentUser = null;
let liveInterval = null;
window._currentAuction = null;

/* ============================================================
   اللغة
   ============================================================ */
function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    const html = document.documentElement;
    html.setAttribute('lang', currentLang);
    html.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    const btn = document.querySelector('.lang-toggle');
    if (btn) btn.textContent = currentLang === 'ar' ? 'EN' : 'عربي';
    localStorage.setItem('alnisrLang', currentLang);
    // تطبيق التحديثات الفورية للنصوص
    updateTexts();
    setTimeout(() => updateTexts(), 50);
    console.log('✅ تم تبديل اللغة إلى:', currentLang);
}

function updateTexts() {
    document.querySelectorAll('[data-ar][data-en]').forEach(el => {
        const text = currentLang === 'ar' ? el.getAttribute('data-ar') : el.getAttribute('data-en');
        if (!text) return;
        
        // للمدخلات والأزرار
        if ((el.tagName === 'INPUT' || el.tagName === 'BUTTON') &&
            ['text','password','number','tel','datetime-local','email'].includes(el.type)) {
            if (el.type === 'button' || el.tagName === 'BUTTON') {
                el.textContent = text;
            } else {
                el.placeholder = text;
            }
        } else {
            // للعناصر الأخرى
            el.textContent = text;
        }
        
        // تحديث title للفائدة الإضافية
        if (el.getAttribute('data-title-ar') && el.getAttribute('data-title-en')) {
            el.title = currentLang === 'ar' ? el.getAttribute('data-title-ar') : el.getAttribute('data-title-en');
        }
    });
}

function applyLang() {
    const html = document.documentElement;
    html.setAttribute('lang', currentLang);
    html.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    const btn = document.querySelector('.lang-toggle');
    if (btn) btn.textContent = currentLang === 'ar' ? 'EN' : 'عربي';
    updateTexts();
    // تطبيق اللغة على جميع العناصر فوراً
    setTimeout(() => updateTexts(), 100);
}

/* ============================================================
   الإشعارات Toast
   ============================================================ */
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

/* ============================================================
   Modal عام
   ============================================================ */
function showModal(title, bodyHTML, onConfirm, confirmLabel) {
    let ov = document.getElementById('modal-overlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'modal-overlay';
        ov.innerHTML = `<div class="modal-box">
            <div class="modal-header"><h2 id="modal-title"></h2><button class="modal-close" onclick="closeModal()">✕</button></div>
            <div class="modal-body" id="modal-body"></div>
            <div class="modal-footer">
                <button class="btn-primary" id="modal-confirm"></button>
                <button class="btn-secondary" onclick="closeModal()">${currentLang==='ar'?'إلغاء':'Cancel'}</button>
            </div></div>`;
        document.body.appendChild(ov);
    }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const cb = document.getElementById('modal-confirm');
    cb.textContent = confirmLabel || (currentLang === 'ar' ? 'تأكيد' : 'Confirm');
    cb.onclick = () => { onConfirm(); closeModal(); };
    ov.classList.add('active');
}

function closeModal() {
    const ov = document.getElementById('modal-overlay');
    if (ov) ov.classList.remove('active');
}

/* ============================================================
   الإشعارات الداخلية للأعضاء
   ============================================================ */
async function addNotification(userId, message, type = 'info') {
    await dbAdd('notifications', { userId, message, type, read: false, createdAt: new Date().toISOString() });
}

async function loadUserNotifications() {
    if (!currentUser) return;
    const all = await dbGetByIndex('notifications', 'userId', currentUser.id);
    const unread = all.filter(n => !n.read);
    const bell = document.getElementById('notif-bell');
    const badge = document.getElementById('notif-badge');
    if (badge) badge.textContent = unread.length;
    if (bell) bell.style.display = 'flex';
    const list = document.getElementById('notif-list');
    if (!list) return;
    list.innerHTML = all.length === 0
        ? `<p class="empty-msg">${currentLang==='ar'?'لا توجد إشعارات':'No notifications'}</p>`
        : [...all].reverse().map(n => `
            <div class="notif-item ${n.read?'':'notif-unread'} notif-${n.type}">
                <div class="notif-msg">${n.message}</div>
                <div class="notif-time">${new Date(n.createdAt).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</div>
                ${!n.read ? `<button onclick="markNotifRead(${n.id})" class="notif-mark-btn">${currentLang==='ar'?'تحديد كمقروء':'Mark read'}</button>` : ''}
            </div>`).join('');
}

async function markNotifRead(id) {
    const n = await dbGet('notifications', id);
    if (n) { n.read = true; await dbPut('notifications', n); await loadUserNotifications(); }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (panel) { panel.classList.toggle('open'); loadUserNotifications(); }
}

/* ============================================================
   تسجيل الدخول / إنشاء الحساب
   ============================================================ */
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const lf = document.getElementById('login-form');
    const rf = document.getElementById('register-form');
    if (tab === 'login') {
        lf.style.display = 'block'; rf.style.display = 'none';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else {
        lf.style.display = 'none'; rf.style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const fullname = document.getElementById('reg-fullname').value.trim();
    const phone    = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm-password').value;

    if (fullname.split(' ').filter(w => w).length < 3) {
        return showToast(currentLang==='ar'?'يجب إدخال الاسم الثلاثي كاملاً':'Full three-part name required','error');
    }
    if (password !== confirm) return showToast(currentLang==='ar'?'كلمة السر غير متطابقة':'Passwords do not match','error');
    if (password.length < 6) return showToast(currentLang==='ar'?'كلمة السر 6 أحرف على الأقل':'Min 6 characters','error');

    try {
        const response = await fetch(`${getApiUrl()}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, phone, password })
        });

        if (!response.ok) {
            const error = await response.json();
            return showToast(error.error, 'error');
        }

        sendServerMessage('NEW_USER', { fullname, phone, password });
        showToast(currentLang==='ar'?'✅ تم إرسال الطلب! انتظر موافقة المشرف':'✅ Request sent! Await admin approval','success');
        event.target.reset();
        showTab('login');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const id  = document.getElementById('login-id').value.trim();
    const pwd = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${getApiUrl()}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password: pwd })
        });

        if (!response.ok) {
            const error = await response.json();
            return showToast(error.error, 'error');
        }

        const user = await response.json();
        currentUser = user;
        localStorage.setItem('alnisrCurrentUser', JSON.stringify(user));
        showToast(currentLang==='ar'?'تم تسجيل الدخول!':'Logged in!','success');
        setTimeout(() => { window.location.href = 'auction.html'; }, 900);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('alnisrCurrentUser');
    window.location.href = 'index.html';
}

/* ============================================================
   صفحة المزاد المباشر
   ============================================================ */
async function checkAuctionAuth() {
    const saved = localStorage.getItem('alnisrCurrentUser');
    if (saved) currentUser = JSON.parse(saved);
    const lr = document.getElementById('login-required');
    const ac = document.getElementById('auction-content');
    const ui = document.getElementById('user-info');
    if (currentUser) {
        lr.style.display = 'none';
        ac.style.display = 'block';
        ui.style.display = 'flex';
        document.getElementById('username').textContent = currentUser.fullname;
        const mid = document.getElementById('member-id-display');
        if (mid) mid.textContent = 'ID: ' + currentUser.id;
        await loadUserNotifications();
        await refreshAuction();
        startLiveRefresh();
    } else {
        lr.style.display = 'block';
        ac.style.display = 'none';
        ui.style.display = 'none';
    }
}

function startLiveRefresh() {
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(async () => {
        await refreshAuction();
        await loadUserNotifications();
    }, 3000);
}

async function refreshAuction() {
    try {
        const response = await fetch(`${getApiUrl()}/auctions`);
        const auctions = await response.json();
        const active = auctions.find(a => a.status === 'active')
                    || auctions.find(a => a.status === 'paused')
                    || [...auctions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]
                    || null;

    const statusEl = document.getElementById('auction-status');
    const dateEl   = document.getElementById('auction-date');
    if (!statusEl) return;

    if (active) {
        const isActive = active.status === 'active';
        const isPaused = active.status === 'paused';
        const isEnded  = active.status === 'ended';

        statusEl.textContent = isActive ? (currentLang==='ar'?'نشط 🟢':'Active 🟢')
            : isPaused ? (currentLang==='ar'?'متوقف ⏸':'Paused ⏸')
            : (currentLang==='ar'?'منتهي 🔴':'Ended 🔴');
        statusEl.className = 'status-badge' + (isActive?' active': isPaused?' paused':'');

        dateEl.textContent = new Date(active.date).toLocaleString(currentLang==='ar'?'ar-AE':'en-US');
        document.getElementById('item-name').textContent = active.itemName;
        document.getElementById('item-description').textContent = active.description || '';
        document.getElementById('start-price').textContent =
            (active.startPrice||0).toLocaleString() + ' ' + (currentLang==='ar'?'د.إ':'AED');

        /* معرض الصور/فيديو للعنصر */
        const galleryBox = document.getElementById('item-gallery');
        if (galleryBox) {
            const mediaUrls = active.mediaGallery && active.mediaGallery.length > 0 
                ? active.mediaGallery 
                : active.mediaUrl ? [active.mediaUrl] : [];
            
            if (mediaUrls.length > 0) {
                let galleryHtml = '<div class="item-media-gallery" style="position:relative;">';
                mediaUrls.forEach((url, idx) => {
                    const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
                    galleryHtml += isVideo 
                        ? `<video src="${url}" controls class="gallery-item" style="display:${idx===0?'block':'none'}"></video>`
                        : `<img src="${url}" alt="${active.itemName}" class="gallery-item" style="display:${idx===0?'block':'none'}" data-idx="${idx}">`;
                });
                if (mediaUrls.length > 1) {
                    galleryHtml += `<button class="gallery-nav prev" onclick="navigateGallery(-1)">❮</button>`;
                    galleryHtml += `<button class="gallery-nav next" onclick="navigateGallery(1)">❯</button>`;
                    galleryHtml += '<div class="gallery-thumbnails">';
                    mediaUrls.forEach((url, idx) => {
                        galleryHtml += `<img src="${url}" class="gallery-thumb ${idx===0?'active':''}" onclick="showGalleryImage(${idx})">`;
                    });
                    galleryHtml += '</div>';
                }
                galleryHtml += '</div>';
                galleryBox.innerHTML = galleryHtml;
                window._galleryImages = mediaUrls;
            } else {
                galleryBox.innerHTML = '<div class="item-media-placeholder">🐦</div>';
            }
        }

        const cp = active.currentPrice || active.startPrice || 0;
        const priceEl = document.getElementById('current-price');
        if (priceEl.dataset.lastPrice && String(cp) !== priceEl.dataset.lastPrice) {
            priceEl.classList.add('price-pulse');
            setTimeout(()=>priceEl.classList.remove('price-pulse'), 800);
        }
        priceEl.dataset.lastPrice = String(cp);
        priceEl.textContent = cp.toLocaleString() + ' ' + (currentLang==='ar'?'د.إ':'AED');

        document.getElementById('highest-bidder').textContent =
            active.highestBidder || (currentLang==='ar'?'لا يوجد':'None');

        /* حالة إنهاء المزاد - رسالة للفائز */
        if (isEnded && currentUser && active.highestBidderId === currentUser.id) {
            const winnerBanner = document.getElementById('winner-banner');
            if (winnerBanner) {
                winnerBanner.style.display = 'block';
                winnerBanner.innerHTML = `
                    <div class="winner-msg">
                        🏆 ${currentLang==='ar'?'مبروك! أنت الفائز بـ':'Congratulations! You won'} <b>${active.itemName}</b>
                        ${currentLang==='ar'?'بسعر':'at price'} <b>${cp.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</b>
                        <br><span class="winner-sub">${currentLang==='ar'?'⏳ بانتظار موافقة البائع...':'⏳ Waiting for seller approval...'}</span>
                        ${active.sellerApproved === true
                            ? `<br><span class="approved-tag">✅ ${currentLang==='ar'?'تمت موافقة البائع':'Seller Approved'}</span>`
                            : active.sellerApproved === false
                            ? `<br><span class="rejected-tag">❌ ${currentLang==='ar'?'رفض البائع':'Seller Rejected'}</span>`
                            : ''}
                    </div>`;
            }
        }

        /* تعطيل/تفعيل زر المزايدة */
        const bidInput = document.getElementById('bid-amount');
        const bidBtn   = document.getElementById('bid-btn');
        if (bidInput && bidBtn) {
            if (isActive) {
                bidInput.disabled = false; bidBtn.disabled = false;
                bidInput.placeholder = (currentLang==='ar'?'أعلى من ':'Above ') + cp.toLocaleString();
            } else {
                bidInput.disabled = true; bidBtn.disabled = true;
                bidInput.placeholder = currentLang==='ar'?'المزاد غير نشط':'Auction inactive';
            }
        }

        window._currentAuction = active;
    } else {
        statusEl.textContent = currentLang==='ar'?'لا يوجد مزاد':'No Auction';
        statusEl.className = 'status-badge';
    }

    await refreshBidHistory();
    } catch (error) {
        console.error('Error refreshing auction:', error);
        statusEl.textContent = currentLang==='ar'?'خطأ في تحميل البيانات':'Error loading data';
    }
}

async function refreshBidHistory() {
    const div = document.getElementById('bid-history');
    if (!div || !window._currentAuction) return;
    
    try {
        const response = await fetch(`/api/bids/${window._currentAuction.id}`);
        const bids = await response.json();
        
        if (!bids.length) {
            div.innerHTML = `<p class="empty-msg">${currentLang==='ar'?'لا توجد مزايدات بعد':'No bids yet'}</p>`;
            return;
        }
        
        const bestPerUser = {};
        bids.forEach(b => { if (!bestPerUser[b.userId] || b.amount > bestPerUser[b.userId]) bestPerUser[b.userId] = b.amount; });
        div.innerHTML = bids.map((b, i) => {
            const isMe = currentUser && b.userId === currentUser.id;
            const isBest = bestPerUser[b.userId] === b.amount;
            return `<div class="history-item ${i===0?'top-bid':''} ${isMe?'my-bid':''}">
                <div class="bid-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
                <div class="bid-info">
                    <strong>${b.userName} ${isMe?'<span class="me-tag">(أنت)</span>':''}</strong>
                    <small>${new Date(b.timestamp).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</small>
                </div>
                <div class="bid-amount-display ${isBest&&i>0?'best-of-user':''}">${b.amount.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</div>
            </div>`;
        }).join('');
    } catch (error) {
        console.error('Error loading bids:', error);
    }
}

async function placeBid() {
    if (!window._currentAuction || window._currentAuction.status !== 'active')
        return showToast(currentLang==='ar'?'المزاد غير نشط':'Auction not active','error');
    
    if (!currentUser)
        return showToast(currentLang==='ar'?'يجب تسجيل الدخول':'Login required','error');
    
    const amount = parseFloat(document.getElementById('bid-amount').value);
    const cp = window._currentAuction.currentPrice || window._currentAuction.startPrice || 0;
    if (!amount || amount <= cp)
        return showToast(currentLang==='ar'?'يجب أن يكون المبلغ أعلى من '+cp.toLocaleString():'Must exceed '+cp,'error');

    try {
        const response = await fetch(`${getApiUrl()}/bid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auctionId: window._currentAuction.id,
                userId: currentUser.id,
                userName: currentUser.fullname,
                amount
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return showToast(error.error, 'error');
        }

        document.getElementById('bid-amount').value = '';
        showToast(currentLang==='ar'?'✅ تم تقديم مزايدتك!':'✅ Bid placed!','success');
        await refreshAuction();
        
        sendServerMessage('NEW_BID', {
            auctionId: window._currentAuction.id,
            userId: currentUser.id,
            userName: currentUser.fullname,
            amount
        });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function quickBid(amount) {
    if (!window._currentAuction) return;
    const cp = window._currentAuction.currentPrice || window._currentAuction.startPrice || 0;
    document.getElementById('bid-amount').value = cp + amount;
}

function navigateGallery(direction) {
    const images = window._galleryImages || [];
    if (images.length === 0) return;
    
    const items = document.querySelectorAll('.gallery-item');
    let currentIdx = 0;
    
    items.forEach((item, idx) => {
        if (item.style.display !== 'none') {
            currentIdx = idx;
            item.style.display = 'none';
        }
    });
    
    let newIdx = (currentIdx + direction + images.length) % images.length;
    items[newIdx].style.display = 'block';
    
    document.querySelectorAll('.gallery-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('active', idx === newIdx);
    });
}

function showGalleryImage(idx) {
    const items = document.querySelectorAll('.gallery-item');
    items.forEach((item, i) => {
        item.style.display = i === idx ? 'block' : 'none';
    });
    
    document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === idx);
    });
}

/* ============================================================
   ملف العضو (profile.html)
   ============================================================ */
async function loadMemberProfile() {
    const saved = localStorage.getItem('alnisrCurrentUser');
    if (!saved) { window.location.href = 'login.html'; return; }
    currentUser = JSON.parse(saved);

    document.getElementById('profile-name').textContent = currentUser.fullname;
    document.getElementById('profile-phone').textContent = currentUser.phone;
    document.getElementById('profile-id').textContent = 'ID: ' + currentUser.id;
    document.getElementById('profile-avatar-letter').textContent = currentUser.fullname.charAt(0);
    document.getElementById('profile-joined').textContent =
        new Date(currentUser.createdAt).toLocaleDateString(currentLang==='ar'?'ar-AE':'en-US');

    const allBids     = await dbGetAll('bids');
    const allAuctions = await dbGetAll('auctions');
    const myBids      = allBids.filter(b => b.userId === currentUser.id);

    document.getElementById('profile-total-bids').textContent = myBids.length;

    /* مزايداتي مرتبة حسب المزاد */
    const grouped = {};
    myBids.forEach(b => {
        if (!grouped[b.auctionId]) grouped[b.auctionId] = [];
        grouped[b.auctionId].push(b);
    });

    const profileList = document.getElementById('profile-auctions-list');
    if (!Object.keys(grouped).length) {
        profileList.innerHTML = `<p class="empty-msg">${currentLang==='ar'?'لم تزايد على أي شيء بعد':'No bids yet'}</p>`;
        return;
    }

    let html = '';
    for (const [auctionId, bids] of Object.entries(grouped)) {
        const auction = allAuctions.find(a => a.id === parseInt(auctionId));
        if (!auction) continue;
        const myBest = Math.max(...bids.map(b => b.amount));
        const isWinner = auction.highestBidderId === currentUser.id;
        const statusMap = {
            active:  { label: currentLang==='ar'?'نشط':'Active',   color:'var(--success-color)' },
            paused:  { label: currentLang==='ar'?'متوقف':'Paused', color:'var(--warning-color)' },
            ended:   { label: currentLang==='ar'?'منتهي':'Ended',  color:'#888' },
            pending: { label: currentLang==='ar'?'قادم':'Upcoming',color:'var(--accent-color)' }
        };
        const st = statusMap[auction.status] || { label: auction.status, color:'#888' };

        let winnerSection = '';
        if (isWinner && auction.status === 'ended') {
            if (auction.sellerApproved === true) {
                winnerSection = `<div class="profile-win-tag approved">✅ ${currentLang==='ar'?'تمت موافقة البائع - مبروك!':'Seller Approved - Congrats!'}</div>`;
            } else if (auction.sellerApproved === false) {
                winnerSection = `<div class="profile-win-tag rejected">❌ ${currentLang==='ar'?'رفض البائع':'Seller Rejected'}</div>`;
            } else {
                winnerSection = `<div class="profile-win-tag pending-approval">⏳ ${currentLang==='ar'?'بانتظار موافقة البائع':'Awaiting seller approval'}</div>`;
            }
        }

        /* صورة/فيديو */
        let media = `<div class="profile-auction-media-placeholder">🐦</div>`;
        if (auction.mediaType === 'image' && auction.mediaUrl) {
            media = `<img src="${auction.mediaUrl}" alt="${auction.itemName}" class="profile-auction-media">`;
        } else if (auction.mediaType === 'video' && auction.mediaUrl) {
            media = `<video src="${auction.mediaUrl}" class="profile-auction-media" controls></video>`;
        }

        html += `
        <div class="profile-auction-card ${isWinner&&auction.status==='ended'?'winner-card':''}">
            ${media}
            <div class="pac-body">
                <div class="pac-header">
                    <h3>${auction.itemName}</h3>
                    <span class="status-pill" style="background:${st.color}">${st.label}</span>
                </div>
                <div class="pac-details">
                    <div class="pac-row"><span>${currentLang==='ar'?'أعلى مزايدتي:':'My Best Bid:'}</span><strong>${myBest.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</strong></div>
                    <div class="pac-row"><span>${currentLang==='ar'?'السعر النهائي:':'Final Price:'}</span><strong>${(auction.currentPrice||auction.startPrice||0).toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</strong></div>
                    <div class="pac-row"><span>${currentLang==='ar'?'الحالة:':'Status:'}</span>
                        <strong>${isWinner?'🏆 '+(currentLang==='ar'?'فائز':'Winner'):currentLang==='ar'?'غير فائز':'Not winner'}</strong>
                    </div>
                    <div class="pac-row"><span>${currentLang==='ar'?'عدد مزايداتي:':'My bids count:'}</span><strong>${bids.length}</strong></div>
                </div>
                ${winnerSection}
            </div>
        </div>`;
    }
    profileList.innerHTML = html;

    await loadUserNotifications();
}

/* ============================================================
   لوحة المشرف
   ============================================================ */
const ADMIN_PASSWORD = 'admin2026';

function handleAdminLogin(event) {
    event.preventDefault();
    if (document.getElementById('admin-password').value === ADMIN_PASSWORD) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        localStorage.setItem('adminLoggedIn', '1');
        loadAdminData();
    } else {
        showToast(currentLang==='ar'?'كلمة السر غير صحيحة':'Incorrect password','error');
    }
}

function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-password').value = '';
    if (liveInterval) clearInterval(liveInterval);
}

function showAdminTab(tab) {
    const tabs = ['dashboard','members','auction','messages','settings'];
    tabs.forEach((t, i) => {
        const c = document.getElementById(`${t}-tab`);
        const b = document.querySelectorAll('.admin-tab-btn')[i];
        if (c) c.style.display = t === tab ? 'block' : 'none';
        if (b) t === tab ? b.classList.add('active') : b.classList.remove('active');
    });
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'members') loadMembersData();
    if (tab === 'auction') loadAuctionTab();
    if (tab === 'messages') loadAdminMessages();
    if (tab === 'settings') loadSettings();
}

async function loadDashboard() {
    try {
        const stats = await fetch(`${getApiUrl()}/stats`).then(r => r.json());
        document.getElementById('dash-pending').textContent = stats.pending || 0;
        document.getElementById('dash-approved').textContent = stats.totalUsers || 0;
        document.getElementById('dash-active').textContent = stats.activeAuctions || 0;
        document.getElementById('dash-revenue').textContent = (stats.totalRevenue || 0).toLocaleString();
    } catch(e) { console.error(e); }
}

async function loadAdminData() {
    await loadMembersData();
    startAdminLiveRefresh();
}

function startAdminLiveRefresh() {
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(async () => {
        const ab = document.querySelector('.admin-tab-btn.active');
        if (!ab) return;
        const txt = ab.getAttribute('data-ar') || ab.textContent;
        if (txt.includes('أعضاء')||txt.includes('Members'))    await loadMembersData();
        if (txt.includes('مزاد')||txt.includes('Auction'))     await refreshAdminCurrentAuction();
        if (txt.includes('إحصاء')||txt.includes('Statistics')) await loadStatistics();
    }, 3000);
}

async function refreshAdminCurrentAuction() {
    const all = await dbGetAll('auctions');
    const cur = all.find(a=>a.status==='active')||all.find(a=>a.status==='paused');
    if (!cur) return;
    const info = document.getElementById('current-auction-info');
    if (!info) return;
    const cp = cur.currentPrice || cur.startPrice || 0;
    const sl = { active:currentLang==='ar'?'نشط':'Active', paused:currentLang==='ar'?'متوقف':'Paused' };
    const sc = { active:'var(--success-color)', paused:'var(--warning-color)' };
    info.innerHTML = `<div class="current-auction-card">
        <div class="ca-name">${cur.itemName}</div>
        <div class="ca-details">
            <span>${currentLang==='ar'?'الحالة:':'Status:'} <b style="color:${sc[cur.status]}">${sl[cur.status]}</b></span>
            <span>${currentLang==='ar'?'السعر:':'Price:'} <b class="live-price-val-sm">${cp.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</b></span>
            <span>${currentLang==='ar'?'أعلى مزايد:':'Top Bidder:'} <b>👑 ${cur.highestBidder||(currentLang==='ar'?'لا يوجد':'None')}</b></span>
        </div>
    </div>`;
    /* تحديث سجل المزايدات في لوحة المشرف */
    await loadAdminBidHistory(cur);
}

async function loadAdminBidHistory(auction) {
    const div = document.getElementById('admin-bid-history');
    if (!div || !auction) return;
    const all = await dbGetAll('bids');
    const bids = all.filter(b=>b.auctionId===auction.id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    div.innerHTML = bids.length===0
        ? `<p class="empty-msg">${currentLang==='ar'?'لا توجد مزايدات':'No bids'}</p>`
        : bids.map((b,i)=>`
            <div class="history-item ${i===0?'top-bid':''}">
                <div class="bid-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
                <div class="bid-info">
                    <strong>${b.userName}</strong>
                    <small>${new Date(b.timestamp).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</small>
                </div>
                <div class="bid-amount-display">${b.amount.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</div>
            </div>`).join('');
}

/* ===== الأعضاء ===== */
async function loadMembersData() {
    const all = await dbGetAll('users');
    const pending  = all.filter(u=>u.status==='pending');
    const approved = all.filter(u=>u.status==='approved');
    const pc = document.getElementById('pending-count');
    const ac = document.getElementById('active-count');
    if (pc) pc.textContent = pending.length;
    if (ac) ac.textContent = approved.length;
    renderPendingMembers(pending);
    renderApprovedMembers(approved);
}

function renderPendingMembers(list) {
    const div = document.getElementById('pending-members');
    if (!div) return;
    div.innerHTML = !list.length
        ? `<p class="empty-msg">${currentLang==='ar'?'لا توجد طلبات':'No requests'}</p>`
        : list.map(u=>`
            <div class="member-card pending-card">
                <div class="member-avatar">${u.fullname.charAt(0)}</div>
                <div class="member-info">
                    <strong>${u.fullname}</strong>
                    <span class="badge badge-pending">${currentLang==='ar'?'معلق':'Pending'}</span><br>
                    <small>📞 ${u.phone}</small><br>
                    <small>🕐 ${new Date(u.createdAt).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</small>
                </div>
                <div class="member-actions">
                    <button onclick="approveUser(${u.id})" class="btn-success">✅ ${currentLang==='ar'?'قبول':'Approve'}</button>
                    <button onclick="rejectUser(${u.id})" class="btn-danger">❌ ${currentLang==='ar'?'رفض':'Reject'}</button>
                </div>
            </div>`).join('');
}

function renderApprovedMembers(list) {
    const div = document.getElementById('approved-members');
    if (!div) return;
    div.innerHTML = !list.length
        ? `<p class="empty-msg">${currentLang==='ar'?'لا يوجد أعضاء':'No members'}</p>`
        : list.map(u=>`
            <div class="member-card">
                <div class="member-avatar">${u.fullname.charAt(0)}</div>
                <div class="member-info">
                    <strong>${u.fullname}</strong>
                    <span class="badge badge-active">${currentLang==='ar'?'عضو':'Member'}</span>
                    <span class="member-id-badge">ID: ${u.id}</span><br>
                    <small>📞 ${u.phone}</small>
                </div>
                <div class="member-actions">
                    <button onclick="viewMemberBids(${u.id})" class="btn-secondary">📋 ${currentLang==='ar'?'المزايدات':'Bids'}</button>
                    <button onclick="openEditUser(${u.id})" class="btn-warning">✏️ ${currentLang==='ar'?'تعديل':'Edit'}</button>
                    <button onclick="deleteUser(${u.id})" class="btn-danger">🗑️ ${currentLang==='ar'?'حذف':'Delete'}</button>
                </div>
            </div>`).join('');
}

async function viewMemberBids(userId) {
    const allBids = await dbGetAll('bids');
    const allAuctions = await dbGetAll('auctions');
    const users = await dbGetAll('users');
    const user = users.find(u=>u.id===userId);
    const myBids = allBids.filter(b=>b.userId===userId).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    let body = `<h3 style="margin-bottom:1rem">${user?.fullname}</h3>`;
    if (!myBids.length) {
        body += `<p class="empty-msg">${currentLang==='ar'?'لا توجد مزايدات':'No bids'}</p>`;
    } else {
        body += myBids.map(b=>{
            const auc = allAuctions.find(a=>a.id===b.auctionId);
            return `<div class="history-item">
                <div class="bid-info"><strong>${auc?auc.itemName:'?'}</strong><small>${new Date(b.timestamp).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</small></div>
                <div class="bid-amount-display">${b.amount.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</div>
            </div>`;
        }).join('');
    }
    showModal(currentLang==='ar'?'سجل مزايدات العضو':'Member Bid History', body, ()=>{}, currentLang==='ar'?'إغلاق':'Close');
}

async function approveUser(id) {
    const u = await dbGet('users', id);
    if (!u) return;
    u.status = 'approved';
    await dbPut('users', u);
    await addNotification(id, currentLang==='ar'?'✅ تمت الموافقة على حسابك! يمكنك الآن المشاركة في المزاد.':'✅ Account approved! You can now join auctions.', 'success');
    showToast(currentLang==='ar'?'تم قبول العضو':'Member approved','success');
    await loadMembersData();
}

async function rejectUser(id) {
    showModal(
        currentLang==='ar'?'رفض الطلب':'Reject',
        `<p>${currentLang==='ar'?'هل تريد رفض وحذف هذا الطلب؟':'Delete this request?'}</p>`,
        async()=>{ await dbDelete('users',id); showToast(currentLang==='ar'?'تم الرفض':'Rejected','info'); await loadMembersData(); }
    );
}

async function deleteUser(id) {
    showModal(
        currentLang==='ar'?'حذف العضو':'Delete Member',
        `<p>${currentLang==='ar'?'هل أنت متأكد من الحذف النهائي؟':'Permanently delete?'}</p>`,
        async()=>{ await dbDelete('users',id); showToast(currentLang==='ar'?'تم الحذف':'Deleted','info'); await loadMembersData(); }
    );
}

async function openEditUser(id) {
    const u = await dbGet('users', id);
    if (!u) return;
    showModal(
        currentLang==='ar'?'تعديل العضو':'Edit Member',
        `<div class="form-group"><label>${currentLang==='ar'?'الاسم الثلاثي':'Full Name'}</label><input type="text" id="edit-name" value="${u.fullname}"></div>
         <div class="form-group"><label>${currentLang==='ar'?'رقم الهاتف':'Phone'}</label><input type="tel" id="edit-phone" value="${u.phone}"></div>
         <div class="form-group"><label>${currentLang==='ar'?'كلمة سر جديدة (اتركها فارغة)':'New Password (leave blank)'}</label><input type="password" id="edit-password"></div>`,
        async()=>{
            const n=document.getElementById('edit-name').value.trim();
            const p=document.getElementById('edit-phone').value.trim();
            const pw=document.getElementById('edit-password').value;
            if(n)u.fullname=n; if(p)u.phone=p; if(pw)u.password=pw;
            await dbPut('users',u);
            showToast(currentLang==='ar'?'تم التعديل':'Updated','success');
            await loadMembersData();
        }
    );
}

/* ===== إدارة المزاد ===== */
async function createAuction(event) {
    event.preventDefault();
    const fileInput = document.getElementById('auction-media-file');
    let mediaUrl = null, mediaType = null;
    if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
        mediaUrl = await readFileAsDataURL(file);
    }
    const auction = {
        itemName:    document.getElementById('auction-item-name').value.trim(),
        description: document.getElementById('auction-item-desc').value.trim(),
        startPrice:  parseFloat(document.getElementById('auction-start-price').value),
        date:        document.getElementById('auction-date').value,
        status:      'pending',
        currentPrice: null,
        highestBidder: null,
        highestBidderId: null,
        sellerApproved: null,
        mediaUrl,
        mediaType,
        createdAt: new Date().toISOString()
    };
    await dbAdd('auctions', auction);
    showToast(currentLang==='ar'?'تم إنشاء المزاد!':'Auction created!','success');
    event.target.reset();
    const preview = document.getElementById('media-preview');
    if (preview) preview.innerHTML = '';
    await loadAuctionTab();
}

function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });
}

function previewMedia() {
    const fileInput = document.getElementById('auction-media-file');
    const preview   = document.getElementById('media-preview');
    if (!fileInput || !preview || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    const url  = URL.createObjectURL(file);
    preview.innerHTML = file.type.startsWith('video')
        ? `<video src="${url}" controls class="media-preview-el"></video>`
        : `<img src="${url}" class="media-preview-el">`;
}

async function setAuctionStatus(status) {
    const all = await dbGetAll('auctions');
    const cur = all.find(a=>a.status==='active'||a.status==='paused'||a.status==='pending');
    if (!cur) return showToast(currentLang==='ar'?'لا يوجد مزاد':'No auction','error');
    cur.status = status;
    if (status === 'ended') {
        /* إرسال إشعار للفائز */
        if (cur.highestBidderId) {
            const msg = currentLang==='ar'
                ? `🏆 أنت الفائز بـ "${cur.itemName}" بسعر ${(cur.currentPrice||0).toLocaleString()} د.إ - بانتظار موافقة البائع`
                : `🏆 You won "${cur.itemName}" at ${(cur.currentPrice||0).toLocaleString()} AED - Awaiting seller approval`;
            await addNotification(cur.highestBidderId, msg, 'success');
        }
    }
    await dbPut('auctions', cur);
    broadcast('AUCTION_STATUS', { auctionId: cur.id, status });
    showToast({ active: currentLang==='ar'?'بدأ المزاد!':'Started!', paused: currentLang==='ar'?'متوقف':'Paused', ended: currentLang==='ar'?'منتهي':'Ended' }[status]||'','success');
    await loadAuctionTab();
}

function startAuction()  { setAuctionStatus('active'); }
function pauseAuction()  { setAuctionStatus('paused'); }
async function endAuction() {
    showModal(
        currentLang==='ar'?'إنهاء المزاد':'End Auction',
        `<p>${currentLang==='ar'?'هل تريد إنهاء المزاد الحالي؟':'End current auction?'}</p>`,
        () => setAuctionStatus('ended')
    );
}

async function approveSellerResult(auctionId, approved) {
    const a = await dbGet('auctions', auctionId);
    if (!a) return;
    a.sellerApproved = approved;
    await dbPut('auctions', a);
    if (a.highestBidderId) {
        const msg = approved
            ? (currentLang==='ar'?`✅ وافق البائع على فوزك بـ "${a.itemName}" - تواصل مع البائع الآن`:`✅ Seller approved your win for "${a.itemName}" - Contact seller`)
            : (currentLang==='ar'?`❌ رفض البائع الصفقة على "${a.itemName}"`:`❌ Seller rejected the deal for "${a.itemName}"`);
        await addNotification(a.highestBidderId, msg, approved ? 'success' : 'error');
    }
    showToast(approved ? (currentLang==='ar'?'تمت موافقة البائع':'Seller approved') : (currentLang==='ar'?'رفض البائع':'Seller rejected'), approved?'success':'info');
    await loadAuctionTab();
}

async function deleteAuction(id) {
    showModal(
        currentLang==='ar'?'حذف المزاد':'Delete',
        `<p>${currentLang==='ar'?'سيتم حذف المزاد وجميع مزايداته':'Delete auction and all its bids?'}</p>`,
        async()=>{
            await dbDelete('auctions', id);
            const bids = await dbGetAll('bids');
            for (const b of bids.filter(b=>b.auctionId===id)) await dbDelete('bids', b.id);
            showToast(currentLang==='ar'?'تم الحذف':'Deleted','info');
            await loadAuctionTab();
        }
    );
}

async function loadAuctionTab() {
    const all = await dbGetAll('auctions');
    const sorted = [...all].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const cur = sorted.find(a=>a.status==='active'||a.status==='paused') || sorted.find(a=>a.status==='pending');
    const sc = { active:'var(--success-color)', paused:'var(--warning-color)', ended:'#888', pending:'var(--accent-color)' };
    const sl = { active:currentLang==='ar'?'نشط':'Active', paused:currentLang==='ar'?'متوقف':'Paused', ended:currentLang==='ar'?'منتهي':'Ended', pending:currentLang==='ar'?'معلق':'Pending' };

    const info = document.getElementById('current-auction-info');
    if (info) {
        if (cur) {
            const cp = cur.currentPrice || cur.startPrice || 0;
            const sellerBtns = cur.status === 'ended'
                ? `<div class="seller-approval-btns">
                    <span>${currentLang==='ar'?'موافقة البائع:':'Seller approval:'}</span>
                    <button onclick="approveSellerResult(${cur.id},true)" class="btn-success">✅ ${currentLang==='ar'?'وافق البائع':'Approve'}</button>
                    <button onclick="approveSellerResult(${cur.id},false)" class="btn-danger">❌ ${currentLang==='ar'?'رفض البائع':'Reject'}</button>
                    ${cur.sellerApproved===true?`<span class="approved-tag">✅ ${currentLang==='ar'?'تمت الموافقة':'Approved'}</span>`
                    : cur.sellerApproved===false?`<span class="rejected-tag">❌ ${currentLang==='ar'?'مرفوض':'Rejected'}</span>`:''}
                   </div>` : '';
            info.innerHTML = `<div class="current-auction-card">
                <div class="ca-name">${cur.itemName}</div>
                <div class="ca-details">
                    <span>${currentLang==='ar'?'الحالة:':'Status:'} <b style="color:${sc[cur.status]}">${sl[cur.status]}</b></span>
                    <span>${currentLang==='ar'?'السعر:':'Price:'} <b>${cp.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</b></span>
                    <span>${currentLang==='ar'?'الفائز:':'Winner:'} <b>👑 ${cur.highestBidder||(currentLang==='ar'?'لا يوجد':'None')}</b></span>
                </div>
                ${sellerBtns}
            </div>`;
        } else {
            info.innerHTML = `<p class="empty-msg">${currentLang==='ar'?'لا يوجد مزاد نشط':'No active auction'}</p>`;
        }
    }

    await loadAdminBidHistory(cur);

    const hist = document.getElementById('auction-history');
    if (!hist) return;
    hist.innerHTML = !sorted.length
        ? `<p class="empty-msg">${currentLang==='ar'?'لا توجد مزادات':'No auctions'}</p>`
        : sorted.map(a => {
            let media = '';
            if (a.mediaType==='image'&&a.mediaUrl) media = `<img src="${a.mediaUrl}" class="auction-thumb">`;
            else if (a.mediaType==='video'&&a.mediaUrl) media = `<video src="${a.mediaUrl}" class="auction-thumb" muted></video>`;
            return `<div class="history-item auction-hist-item">
                ${media}
                <div class="bid-info">
                    <strong>${a.itemName}</strong>
                    <small>${currentLang==='ar'?'السعر:':'Price:'} ${(a.currentPrice||a.startPrice||0).toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</small>
                    <small>${currentLang==='ar'?'الفائز:':'Winner:'} ${a.highestBidder||(currentLang==='ar'?'لا يوجد':'None')}</small>
                    ${a.sellerApproved===true?`<small style="color:var(--success-color)">✅ ${currentLang==='ar'?'موافق':'Approved'}</small>`
                    : a.sellerApproved===false?`<small style="color:var(--danger-color)">❌ ${currentLang==='ar'?'مرفوض':'Rejected'}</small>`:''}
                </div>
                <div class="auction-hist-actions">
                    <span class="status-pill" style="background:${sc[a.status]}">${sl[a.status]}</span>
                    <button onclick="deleteAuction(${a.id})" class="btn-danger btn-sm">🗑️</button>
                </div>
            </div>`;
        }).join('');
}

/* ===== الإحصائيات ===== */
async function loadStatistics() {
    const [users, auctions, bids] = await Promise.all([dbGetAll('users'), dbGetAll('auctions'), dbGetAll('bids')]);
    const el = id => document.getElementById(id);

    if(el('total-auctions')) el('total-auctions').textContent = auctions.length;
    if(el('total-bids'))     el('total-bids').textContent     = bids.length;
    if(el('total-members'))  el('total-members').textContent  = users.filter(u=>u.status==='approved').length;
    if(el('total-revenue'))  el('total-revenue').textContent  = auctions.filter(a=>a.status==='ended').reduce((s,a)=>s+(a.currentPrice||0),0).toLocaleString() + (currentLang==='ar'?' د.إ':' AED');

    const log = el('activity-log');
    if (log) {
        const recent = [...bids].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,20);
        log.innerHTML = !recent.length
            ? `<p class="empty-msg">${currentLang==='ar'?'لا نشاط':'No activity'}</p>`
            : recent.map(b=>`
                <div class="log-item">
                    <span class="log-icon">💰</span>
                    <div><strong>${b.userName}</strong> ${currentLang==='ar'?'زايد بـ':'bid'} <strong>${b.amount.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</strong><br>
                    <small>${new Date(b.timestamp).toLocaleString(currentLang==='ar'?'ar-AE':'en-US')}</small></div>
                </div>`).join('');
    }

    const topDiv = el('top-bidders-list');
    if (topDiv) {
        const byUser = {};
        bids.forEach(b => {
            if (!byUser[b.userName]) byUser[b.userName] = { count:0, total:0 };
            byUser[b.userName].count++;
            byUser[b.userName].total += b.amount;
        });
        const top = Object.entries(byUser).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
        topDiv.innerHTML = !top.length
            ? `<p class="empty-msg">${currentLang==='ar'?'لا بيانات':'No data'}</p>`
            : top.map(([name,d],i)=>`
                <div class="bidder-card">
                    <span class="rank-badge">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</span>
                    <strong>${name}</strong>
                    <div style="text-align:end">
                        <div style="font-weight:700;color:var(--primary-color)">${d.total.toLocaleString()} ${currentLang==='ar'?'د.إ':'AED'}</div>
                        <small>${d.count} ${currentLang==='ar'?'مزايدة':'bids'}</small>
                    </div>
                </div>`).join('');
    }
}

/* ===== الإعدادات ===== */
async function loadSettings() {
    const s = await dbGet('settings', 'general') || {};
    const f = id => document.getElementById(id);
    if(f('setting-site-name'))      f('setting-site-name').value      = s.siteName      || 'ALNISR ALASWAD';
    if(f('setting-whatsapp'))       f('setting-whatsapp').value       = s.whatsapp       || '+971544358897';
    if(f('setting-admin-password')) f('setting-admin-password').value = '';
}

async function saveSettings(event) {
    event.preventDefault();
    const f = id => document.getElementById(id);
    const current = await dbGet('settings', 'general') || { key: 'general' };
    if(f('setting-site-name'))      current.siteName  = f('setting-site-name').value.trim();
    if(f('setting-whatsapp'))       current.whatsapp  = f('setting-whatsapp').value.trim();
    const newPwd = f('setting-admin-password')?.value;
    if (newPwd && newPwd.length >= 6) {
        showModal(
            currentLang==='ar'?'تغيير كلمة السر':'Change Password',
            `<p>${currentLang==='ar'?'أدخل كلمة السر الحالية للتأكيد:':'Enter current password to confirm:'}</p>
             <input type="password" id="confirm-old-pwd" style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:6px">`,
            async () => {
                const old = document.getElementById('confirm-old-pwd')?.value;
                if (old !== ADMIN_PASSWORD && old !== (await dbGet('settings','general'))?.adminPassword) {
                    return showToast(currentLang==='ar'?'كلمة السر الحالية خاطئة':'Wrong current password','error');
                }
                current.adminPassword = newPwd;
                await dbPut('settings', current);
                showToast(currentLang==='ar'?'تم تغيير كلمة السر':'Password changed','success');
            }
        );
    }
    await dbPut('settings', current);
    showToast(currentLang==='ar'?'✅ تم حفظ الإعدادات':'✅ Settings saved','success');
}

async function exportData() {
    const [users, auctions, bids] = await Promise.all([dbGetAll('users'), dbGetAll('auctions'), dbGetAll('bids')]);
    const data = JSON.stringify({ users, auctions, bids, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alnisr_backup_${Date.now()}.json`;
    a.click();
    showToast(currentLang==='ar'?'تم تصدير البيانات':'Data exported','success');
}

/* ===== الوظائف الجديدة ===== */
async function loadAdminMessages() {
    try {
        const res = await fetch(`${getApiUrl()}/messages`);
        const messages = await res.json();
        const container = document.getElementById('admin-messages-list');
        if (!container) return;
        
        if (!messages.length) {
            container.innerHTML = `<p class="empty-msg">${currentLang==='ar'?'لا توجد رسائل':'No messages'}</p>`;
            return;
        }
        
        container.innerHTML = messages.slice(0, 20).map(m => `
            <div class="message-card">
                <div class="msg-sender">${m.senderName}</div>
                <div class="msg-content">${m.content}</div>
                <div class="msg-time">${new Date(m.createdAt).toLocaleString()}</div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
}

async function sendBroadcast(event) {
    event.preventDefault();
    const content = document.getElementById('broadcast-msg')?.value?.trim();
    if (!content) return;
    
    try {
        await fetch(`${getApiUrl()}/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        showToast(currentLang==='ar'?'✅ تم الإرسال':'✅ Sent','success');
        document.getElementById('broadcast-msg').value = '';
    } catch(e) {
        showToast(e.message, 'error');
    }
}

function extendAuction() {
    const btn = document.querySelector('#auction-tab .btn-info');
    if (btn) btn.textContent = '⏰ +5m';
    if (window._currentAuction) {
        fetch(`/api/admin/extend-auction/${window._currentAuction.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extendMinutes: 5 })
        }).then(r => r.json()).then(d => {
            showToast(currentLang==='ar'?'✅ تم التمديد':'✅ Extended','success');
        });
    }
}

async function backupDatabase() {
    await exportData();
    showToast(currentLang==='ar'?'✅ تم أخذ النسخة الاحتياطية':'✅ Backup done','success');
}

function clearAllData() {
    showModal(
        currentLang==='ar'?'تحذير':'Warning',
        `<p>${currentLang==='ar'?'سيتم حذف جميع البيانات نهائياً!':'All data will be deleted!'}</p>`,
        async () => {
            if (confirm(currentLang==='ar'?'اكتب "DELETE" للتأكيد':'Type "DELETE" to confirm')) {
                await fetch(`${getApiUrl()}/admin/clear-all`, { method: 'POST' });
                showToast(currentLang==='ar'?'✅ تم المسح':'✅ Cleared','success');
            }
        },
        currentLang==='ar'?'حذف الكل':'Clear All'
    );
}

/* ============================================================
   التهيئة الرئيسية
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    applyLang();
    initWebSocket();
    startPolling();
    const path = window.location.pathname;

    if (path.includes('auction.html')) {
        await checkAuctionAuth();
    } else if (path.includes('admin.html')) {
        if (localStorage.getItem('adminLoggedIn') === '1') {
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            await loadAdminData();
        }
    } else if (path.includes('profile.html')) {
        await loadMemberProfile();
        if (liveInterval) clearInterval(liveInterval);
        liveInterval = setInterval(loadMemberProfile, 5000);
    } else if (path.includes('login.html')) {
        const saved = localStorage.getItem('alnisrCurrentUser');
        if (saved) currentUser = JSON.parse(saved);
    }
});
