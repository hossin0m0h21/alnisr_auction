const API_BASE =
    window.ALNISR_API_BASE ||
    document.querySelector('meta[name="alnisr-api-base"]')?.content ||
    '/api';
const DEFAULT_SITE_NAME = 'ALNISR';

const state = {
    lang: localStorage.getItem('alnisrLang') || 'ar',
    currentUser: loadCurrentUser(),
    adminLoggedIn: localStorage.getItem('adminLoggedIn') === '1',
    currentAuction: null,
    ws: null,
    timerInterval: null,
    pageInterval: null
};

window.db = { ready: true };
window._currentAuction = null;
window._galleryImages = [];

function loadCurrentUser() {
    try {
        const raw = localStorage.getItem('alnisrCurrentUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveCurrentUser(user) {
    state.currentUser = user;
    localStorage.setItem('alnisrCurrentUser', JSON.stringify(user));
}

function clearCurrentUser() {
    state.currentUser = null;
    localStorage.removeItem('alnisrCurrentUser');
}

function currentPath() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function isPage(name) {
    return currentPath() === name;
}

function getApiUrl(path = '') {
    return `${API_BASE}${path}`;
}

async function apiFetch(path, options = {}) {
    const response = await fetch(getApiUrl(path), {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message =
            (data && typeof data === 'object' && data.message) ||
            `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return data;
}

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatMoney(value) {
    const amount = Number(value || 0);
    const suffix = state.lang === 'ar' ? 'د.إ' : 'AED';
    return `${amount.toLocaleString()} ${suffix}`;
}

function formatDateTime(value) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString(state.lang === 'ar' ? 'ar-AE' : 'en-US');
}

function getStatusLabel(status) {
    const labels = {
        pending: { ar: 'قادم', en: 'Upcoming' },
        active: { ar: 'نشط', en: 'Active' },
        paused: { ar: 'متوقف', en: 'Paused' },
        ended: { ar: 'منتهي', en: 'Ended' }
    };

    return labels[status]?.[state.lang] || status || '-';
}

function getStatusClass(status) {
    if (status === 'active') return 'success';
    if (status === 'paused') return 'warning';
    if (status === 'ended') return 'info';
    return 'secondary';
}

function createToastContainer() {
    let container = document.querySelector('.toast-container');
    if (container) {
        return container;
    }

    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = state.lang === 'ar' ? '20px' : 'auto';
    container.style.right = state.lang === 'ar' ? 'auto' : '20px';
    container.style.zIndex = '9999';
    container.style.display = 'grid';
    container.style.gap = '10px';
    document.body.appendChild(container);
    return container;
}

function showToast(message, type = 'success', duration = 3500) {
    const container = createToastContainer();
    const toast = document.createElement('div');
    const colors = {
        success: '#1d7f49',
        error: '#b42318',
        warning: '#b54708',
        info: '#175cd3'
    };

    toast.textContent = message;
    toast.style.background = colors[type] || colors.success;
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 20px rgba(0,0,0,0.18)';
    toast.style.maxWidth = '320px';
    toast.style.lineHeight = '1.5';
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

function showModal(title, bodyHTML, onConfirm = null, confirmLabel = null) {
    const oldModal = document.querySelector('.alnisr-modal');
    if (oldModal) {
        oldModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'alnisr-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    overlay.style.zIndex = '10000';

    const card = document.createElement('div');
    card.style.background = 'white';
    card.style.borderRadius = '18px';
    card.style.padding = '24px';
    card.style.width = 'min(560px, 100%)';
    card.style.maxHeight = '80vh';
    card.style.overflow = 'auto';
    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
            <h3 style="margin:0;">${escapeHtml(title)}</h3>
            <button type="button" data-close-modal style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
        </div>
        <div style="line-height:1.7;">${bodyHTML}</div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
            <button type="button" data-close-modal class="btn-secondary">${state.lang === 'ar' ? 'إغلاق' : 'Close'}</button>
            ${onConfirm ? `<button type="button" data-confirm-modal class="btn-primary">${escapeHtml(confirmLabel || (state.lang === 'ar' ? 'تأكيد' : 'Confirm'))}</button>` : ''}
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => overlay.remove());
    });

    if (onConfirm) {
        overlay.querySelector('[data-confirm-modal]')?.addEventListener('click', async () => {
            try {
                await onConfirm();
                overlay.remove();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
}

function closeModal() {
    document.querySelector('.alnisr-modal')?.remove();
}

function toggleLanguage() {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('alnisrLang', state.lang);
    applyLang();

    if (isPage('auction.html')) {
        renderAuction(state.currentAuction);
        refreshBidHistory();
    }

    if (isPage('profile.html')) {
        loadMemberProfile();
    }
}

function applyLang() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-ar][data-en]').forEach((element) => {
        element.textContent = state.lang === 'ar' ? element.dataset.ar : element.dataset.en;
    });

    document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach((element) => {
        element.placeholder = state.lang === 'ar'
            ? element.dataset.placeholderAr
            : element.dataset.placeholderEn;
    });

    document.querySelectorAll('.lang-toggle').forEach((button) => {
        button.textContent = state.lang === 'ar' ? 'EN' : 'AR';
    });
}

async function initDB() {
    return true;
}

async function dbGetAll(storeName) {
    if (storeName === 'auctions') {
        return apiFetch('/auctions');
    }

    if (storeName === 'users') {
        return apiFetch('/public/users');
    }

    if (storeName === 'bids') {
        return apiFetch('/bids');
    }

    if (storeName === 'messages') {
        return apiFetch('/messages?all=1');
    }

    return [];
}

async function dbPut() {
    return null;
}

async function dbDelete() {
    return null;
}

function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
}

function initWebSocket() {
    if (state.ws && state.ws.readyState <= 1) {
        return state.ws;
    }

    try {
        state.ws = new WebSocket(getWebSocketUrl());
        state.ws.addEventListener('message', async (event) => {
            try {
                const payload = JSON.parse(event.data);
                await handleServerMessage(payload);
            } catch (error) {
                console.error('WebSocket parse error:', error);
            }
        });

        state.ws.addEventListener('close', () => {
            setTimeout(() => {
                if (document.visibilityState === 'visible') {
                    initWebSocket();
                }
            }, 3000);
        });
    } catch (error) {
        console.error('WebSocket init error:', error);
    }

    return state.ws;
}

async function handleServerMessage(message) {
    const type = message?.type;

    if (type === 'bid_placed' || type === 'auction_sync' || type === 'store_reset') {
        if (isPage('auction.html')) {
            await refreshAuction();
        }
        if (isPage('admin.html')) {
            await refreshAdminCurrentAuction();
            await loadDashboard();
        }
        if (isPage('index.html')) {
            window.dispatchEvent(new Event('alnisr-home-refresh'));
        }
    }

    if (type === 'users_changed' && isPage('admin.html')) {
        await loadMembersData();
        await loadDashboard();
    }

    if ((type === 'message_created' || type === 'broadcast_sent') && typeof window.loadChatMessages === 'function') {
        await window.loadChatMessages();
    }

    if (type === 'settings_changed') {
        await loadSettings();
    }
}

function clearPageInterval() {
    if (state.pageInterval) {
        clearInterval(state.pageInterval);
        state.pageInterval = null;
    }
}

function setPageInterval(callback, ms) {
    clearPageInterval();
    state.pageInterval = setInterval(callback, ms);
}

async function primeCurrentAuction() {
    const auctions = await apiFetch('/auctions');
    state.currentAuction =
        auctions.find((auction) => auction.status === 'active') ||
        auctions.find((auction) => auction.status === 'paused') ||
        auctions.find((auction) => auction.status === 'pending') ||
        null;
    window._currentAuction = state.currentAuction;
    return state.currentAuction;
}

function showTab(tab) {
    const loginForm = $('login-form');
    const registerForm = $('register-form');
    const buttons = document.querySelectorAll('.tab-btn');

    buttons.forEach((button) => button.classList.remove('active'));

    if (tab === 'register') {
        registerForm && (registerForm.style.display = 'block');
        loginForm && (loginForm.style.display = 'none');
        buttons[1]?.classList.add('active');
    } else {
        registerForm && (registerForm.style.display = 'none');
        loginForm && (loginForm.style.display = 'block');
        buttons[0]?.classList.add('active');
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const fullname = $('reg-fullname')?.value.trim();
    const phone = $('reg-phone')?.value.trim();
    const password = $('reg-password')?.value || '';
    const confirmPassword = $('reg-confirm-password')?.value || '';

    if (password !== confirmPassword) {
        showToast(state.lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match', 'error');
        return;
    }

    try {
        await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({ fullname, phone, password })
        });

        showToast(
            state.lang === 'ar'
                ? 'تم إرسال طلب التسجيل. انتظر موافقة المشرف.'
                : 'Registration sent. Wait for admin approval.'
        );
        event.target.reset();
        showTab('login');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();

    try {
        const user = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({
                identifier: $('login-id')?.value.trim(),
                password: $('login-password')?.value || ''
            })
        });

        saveCurrentUser(user.user);
        showToast(state.lang === 'ar' ? 'تم تسجيل الدخول' : 'Logged in successfully');
        setTimeout(() => {
            window.location.href = 'auction.html';
        }, 500);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    clearCurrentUser();
    window.location.href = 'index.html';
}

async function checkAuctionAuth() {
    const loginRequired = $('login-required');
    const auctionContent = $('auction-content');
    const userInfo = $('user-info');
    const username = $('username');
    const memberId = $('member-id-display');

    if (!state.currentUser) {
        loginRequired && (loginRequired.style.display = 'block');
        auctionContent && (auctionContent.style.display = 'none');
        userInfo && (userInfo.style.display = 'none');
        return false;
    }

    loginRequired && (loginRequired.style.display = 'none');
    auctionContent && (auctionContent.style.display = 'block');
    userInfo && (userInfo.style.display = 'flex');
    if (username) username.textContent = state.currentUser.fullname;
    if (memberId) memberId.textContent = state.currentUser.memberId || '';
    return true;
}

function updateAuctionTimer() {
    const timer = $('auction-timer-display');
    if (!timer || !state.currentAuction?.endAt || state.currentAuction.status !== 'active') {
        if (timer) {
            timer.textContent = '--:--';
        }
        return;
    }

    const remaining = new Date(state.currentAuction.endAt).getTime() - Date.now();
    if (remaining <= 0) {
        timer.textContent = '00:00';
        return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    timer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderAuction(auction) {
    const statusEl = $('auction-status');
    const dateEl = $('auction-date');
    const nameEl = $('item-name');
    const descriptionEl = $('item-description');
    const startPriceEl = $('start-price');
    const currentPriceEl = $('current-price');
    const highestBidderEl = $('highest-bidder');
    const galleryEl = $('item-gallery');
    const bidInput = $('bid-amount');
    const bidBtn = $('bid-btn');

    if (!auction) {
        if (nameEl) nameEl.textContent = state.lang === 'ar' ? 'لا يوجد مزاد حاليًا' : 'No auction is running';
        if (descriptionEl) descriptionEl.textContent = state.lang === 'ar'
            ? 'أنشئ مزادًا جديدًا من لوحة المشرف.'
            : 'Create a new auction from the admin panel.';
        if (galleryEl) {
            galleryEl.innerHTML = '<div class="empty-msg">No media</div>';
        }
        if (statusEl) statusEl.textContent = '-';
        if (dateEl) dateEl.textContent = '-';
        if (startPriceEl) startPriceEl.textContent = '-';
        if (currentPriceEl) currentPriceEl.textContent = '-';
        if (highestBidderEl) highestBidderEl.textContent = '-';
        if (bidInput) bidInput.disabled = true;
        if (bidBtn) bidBtn.disabled = true;
        return;
    }

    state.currentAuction = auction;
    window._currentAuction = auction;

    if (statusEl) {
        statusEl.textContent = getStatusLabel(auction.status);
        statusEl.className = `status-badge ${getStatusClass(auction.status)}`;
    }
    if (dateEl) dateEl.textContent = formatDateTime(auction.endAt || auction.createdAt);
    if (nameEl) nameEl.textContent = auction.itemName;
    if (descriptionEl) descriptionEl.textContent = auction.description || '';
    if (startPriceEl) startPriceEl.textContent = formatMoney(auction.startPrice);
    if (currentPriceEl) currentPriceEl.textContent = formatMoney(auction.currentPrice);
    if (highestBidderEl) highestBidderEl.textContent = auction.highestBidderName || (state.lang === 'ar' ? 'لا يوجد بعد' : 'No bids yet');

    if (galleryEl) {
        galleryEl.innerHTML = auction.media?.length
            ? auction.media.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(auction.itemName)}" class="gallery-img">`).join('')
            : `<div class="profile-auction-media-placeholder">🐦</div>`;
    }

    if (bidInput) {
        bidInput.disabled = auction.status !== 'active';
        bidInput.min = Number(auction.currentPrice || auction.startPrice || 0) + Number(auction.minimumIncrement || 0);
    }
    if (bidBtn) {
        bidBtn.disabled = auction.status !== 'active';
    }

    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(updateAuctionTimer, 1000);
    updateAuctionTimer();
}

async function refreshAuction() {
    const auctions = await apiFetch('/auctions');
    const active =
        auctions.find((auction) => auction.status === 'active') ||
        auctions.find((auction) => auction.status === 'paused') ||
        auctions.find((auction) => auction.status === 'pending') ||
        null;

    renderAuction(active);
    await refreshBidHistory();
}

async function refreshBidHistory() {
    const history = $('bid-history');
    if (!history || !state.currentAuction) {
        return;
    }

    const bids = await apiFetch(`/bids/${state.currentAuction.id}`);
    if (!bids.length) {
        history.innerHTML = `<p class="empty-msg">${state.lang === 'ar' ? 'لا توجد مزايدات بعد' : 'No bids yet'}</p>`;
        return;
    }

    history.innerHTML = bids.map((bid) => `
        <div class="history-item">
            <div>
                <strong>${escapeHtml(bid.bidderName)}</strong>
                <div class="history-meta">${formatDateTime(bid.createdAt)}</div>
            </div>
            <div class="history-price">${formatMoney(bid.amount)}</div>
        </div>
    `).join('');
}

async function placeBid() {
    if (!state.currentAuction || !state.currentUser) {
        showToast(state.lang === 'ar' ? 'سجّل الدخول أولًا' : 'Please login first', 'error');
        return;
    }

    const amount = Number($('bid-amount')?.value || 0);

    try {
        await apiFetch('/bid', {
            method: 'POST',
            body: JSON.stringify({
                auctionId: state.currentAuction.id,
                userId: state.currentUser.id,
                amount
            })
        });

        $('bid-amount').value = '';
        showToast(state.lang === 'ar' ? 'تم تسجيل المزايدة' : 'Bid placed successfully');
        await refreshAuction();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function quickBid(amount) {
    if (!state.currentAuction) {
        return;
    }

    const current = Number(state.currentAuction.currentPrice || state.currentAuction.startPrice || 0);
    const input = $('bid-amount');
    if (input) {
        input.value = current + amount;
    }
}

async function loadMemberProfile() {
    if (!state.currentUser) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = await apiFetch(`/user/${state.currentUser.id}`);
        const bids = await apiFetch(`/user-bids/${state.currentUser.id}`);

        $('profile-name') && ($('profile-name').textContent = user.fullname);
        $('profile-phone') && ($('profile-phone').textContent = user.phone);
        $('profile-id') && ($('profile-id').textContent = user.memberId);
        $('profile-joined') && ($('profile-joined').textContent = formatDateTime(user.createdAt));
        $('profile-total-bids') && ($('profile-total-bids').textContent = bids.length);

        const avatarLetter = $('profile-avatar-letter');
        if (avatarLetter) {
            avatarLetter.textContent = user.fullname?.charAt(0)?.toUpperCase() || '👤';
        }

        const list = $('profile-auctions-list');
        if (!list) {
            return;
        }

        if (!bids.length) {
            list.innerHTML = `<p class="empty-msg">${state.lang === 'ar' ? 'لم تقم بأي مزايدة بعد' : 'No bids yet'}</p>`;
            return;
        }

        list.innerHTML = bids.map((bid) => {
            const auction = bid.auction;
            if (!auction) {
                return '';
            }

            const isWinner = auction.highestBidderId === state.currentUser.id && auction.status === 'ended';
            const winnerTag = isWinner
                ? `<div class="profile-win-tag approved">${state.lang === 'ar' ? `فزت بهذا المزاد - ${auction.winnerCode || ''}` : `You won this auction - ${auction.winnerCode || ''}`}</div>`
                : '';

            return `
                <div class="profile-auction-card ${isWinner ? 'winner-card' : ''}">
                    <div class="profile-auction-media-placeholder">🐦</div>
                    <div class="pac-body">
                        <div>
                            <div class="pac-header">
                                <h3>${escapeHtml(auction.itemName)}</h3>
                                <span class="status-pill">${escapeHtml(getStatusLabel(auction.status))}</span>
                            </div>
                            <div class="pac-details">
                                <div class="pac-row">
                                    <span>${state.lang === 'ar' ? 'آخر مزايدة' : 'Your Bid'}</span>
                                    <strong>${formatMoney(bid.amount)}</strong>
                                </div>
                                <div class="pac-row">
                                    <span>${state.lang === 'ar' ? 'السعر النهائي' : 'Current Price'}</span>
                                    <strong>${formatMoney(auction.currentPrice)}</strong>
                                </div>
                                <div class="pac-row">
                                    <span>${state.lang === 'ar' ? 'التاريخ' : 'Date'}</span>
                                    <strong>${formatDateTime(bid.createdAt)}</strong>
                                </div>
                            </div>
                        </div>
                        ${winnerTag}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showAdminPanel(isVisible) {
    const login = $('admin-login');
    const panel = $('admin-panel');

    if (login) {
        login.style.display = isVisible ? 'none' : 'block';
    }
    if (panel) {
        panel.style.display = isVisible ? 'block' : 'none';
    }
}

async function handleAdminLogin(event) {
    event.preventDefault();

    try {
        await apiFetch('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password: $('admin-password')?.value || '' })
        });

        localStorage.setItem('adminLoggedIn', '1');
        state.adminLoggedIn = true;
        showAdminPanel(true);
        showToast(state.lang === 'ar' ? 'تم تسجيل دخول المشرف' : 'Admin login successful');
        await loadAdminData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    state.adminLoggedIn = false;
    showAdminPanel(false);
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach((button) => button.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach((content) => {
        content.style.display = 'none';
    });

    const button = Array.from(document.querySelectorAll('.admin-tab-btn')).find((item) => item.onclick?.toString().includes(`'${tab}'`));
    button?.classList.add('active');

    const target = $(`${tab}-tab`);
    if (target) {
        target.style.display = 'block';
    }

    if (tab === 'dashboard') loadDashboard();
    if (tab === 'members') loadMembersData();
    if (tab === 'auction') loadAuctionTab();
    if (tab === 'messages') loadAdminMessages();
    if (tab === 'settings') loadSettings();
}

async function loadDashboard() {
    const stats = await apiFetch('/stats');
    $('dash-pending') && ($('dash-pending').textContent = stats.pendingUsers || 0);
    $('dash-approved') && ($('dash-approved').textContent = stats.approvedUsers || 0);
    $('dash-active') && ($('dash-active').textContent = stats.activeAuctions || 0);
    $('dash-revenue') && ($('dash-revenue').textContent = formatMoney(stats.totalRevenue || 0));

    const [bids, auctions, messages] = await Promise.all([
        apiFetch('/bids'),
        apiFetch('/auctions'),
        apiFetch('/messages?all=1')
    ]);

    const recentActivity = [
        ...bids.slice(0, 4).map((bid) => ({
            text: `${bid.bidderName} bid ${formatMoney(bid.amount)}`,
            time: bid.createdAt
        })),
        ...messages.slice(-4).map((message) => ({
            text: `${message.senderName}: ${message.content}`,
            time: message.createdAt
        })),
        ...auctions.slice(0, 2).map((auction) => ({
            text: `${auction.itemName} - ${getStatusLabel(auction.status)}`,
            time: auction.createdAt
        }))
    ]
        .sort((left, right) => new Date(right.time) - new Date(left.time))
        .slice(0, 8);

    const timeline = $('recent-activity');
    if (!timeline) {
        return;
    }

    timeline.innerHTML = recentActivity.length
        ? recentActivity.map((item) => `
            <div class="history-item">
                <div>${escapeHtml(item.text)}</div>
                <div class="history-meta">${formatDateTime(item.time)}</div>
            </div>
        `).join('')
        : `<p class="empty-msg">${state.lang === 'ar' ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>`;
}

async function loadMembersData() {
    const users = await apiFetch('/admin/users');
    const pending = users.filter((user) => user.status === 'pending');
    const approved = users.filter((user) => user.status === 'approved');

    $('pending-count') && ($('pending-count').textContent = pending.length);
    $('active-count') && ($('active-count').textContent = approved.length);

    renderPendingMembers(pending);
    renderApprovedMembers(approved);
}

function renderPendingMembers(list) {
    const container = $('pending-members');
    if (!container) {
        return;
    }

    container.innerHTML = list.length
        ? list.map((user) => `
            <div class="history-item">
                <div>
                    <strong>${escapeHtml(user.fullname)}</strong>
                    <div class="history-meta">${escapeHtml(user.phone)} • ${escapeHtml(user.memberId || '')}</div>
                </div>
                <div class="control-buttons">
                    <button class="btn-success" onclick="approveUser('${user.id}')">${state.lang === 'ar' ? 'موافقة' : 'Approve'}</button>
                    <button class="btn-danger" onclick="rejectUser('${user.id}')">${state.lang === 'ar' ? 'رفض' : 'Reject'}</button>
                </div>
            </div>
        `).join('')
        : `<p class="empty-msg">${state.lang === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending users'}</p>`;
}

function renderApprovedMembers(list) {
    const container = $('approved-members');
    if (!container) {
        return;
    }

    container.innerHTML = list.length
        ? list.map((user) => `
            <div class="history-item">
                <div>
                    <strong>${escapeHtml(user.fullname)}</strong>
                    <div class="history-meta">${escapeHtml(user.phone)} • ${escapeHtml(user.memberId || '')}</div>
                </div>
                <div class="control-buttons">
                    <button class="btn-info" onclick="viewMemberBids('${user.id}')">${state.lang === 'ar' ? 'المزايدات' : 'Bids'}</button>
                    <button class="btn-danger" onclick="deleteUser('${user.id}')">${state.lang === 'ar' ? 'حذف' : 'Delete'}</button>
                </div>
            </div>
        `).join('')
        : `<p class="empty-msg">${state.lang === 'ar' ? 'لا يوجد أعضاء معتمدون' : 'No approved members'}</p>`;
}

async function viewMemberBids(userId) {
    const user = await apiFetch(`/user/${userId}`);
    const bids = await apiFetch(`/user-bids/${userId}`);

    const content = bids.length
        ? bids.map((bid) => `
            <div style="padding:10px 0;border-bottom:1px solid #eee;">
                <strong>${escapeHtml(bid.auction?.itemName || '-')}</strong>
                <div>${formatMoney(bid.amount)}</div>
                <small>${formatDateTime(bid.createdAt)}</small>
            </div>
        `).join('')
        : `<p>${state.lang === 'ar' ? 'لا توجد مزايدات لهذا العضو' : 'No bids for this member'}</p>`;

    showModal(user.fullname, content);
}

async function approveUser(id) {
    await apiFetch(`/admin/approve-user/${id}`, { method: 'POST' });
    showToast(state.lang === 'ar' ? 'تمت الموافقة' : 'User approved');
    await loadMembersData();
    await loadDashboard();
}

async function rejectUser(id) {
    showModal(
        state.lang === 'ar' ? 'رفض العضو' : 'Reject member',
        `<p>${state.lang === 'ar' ? 'سيتم حذف طلب العضو نهائيًا.' : 'This will remove the member request permanently.'}</p>`,
        async () => {
            await apiFetch(`/users/${id}`, { method: 'DELETE' });
            showToast(state.lang === 'ar' ? 'تم حذف الطلب' : 'Member request removed');
            await loadMembersData();
            await loadDashboard();
        },
        state.lang === 'ar' ? 'تأكيد الحذف' : 'Confirm'
    );
}

async function deleteUser(id) {
    showModal(
        state.lang === 'ar' ? 'حذف العضو' : 'Delete member',
        `<p>${state.lang === 'ar' ? 'سيتم حذف العضو من النظام.' : 'This will delete the member from the system.'}</p>`,
        async () => {
            await apiFetch(`/users/${id}`, { method: 'DELETE' });
            showToast(state.lang === 'ar' ? 'تم حذف العضو' : 'Member deleted');
            await loadMembersData();
            await loadDashboard();
        },
        state.lang === 'ar' ? 'حذف' : 'Delete'
    );
}

async function refreshAdminCurrentAuction() {
    const auctions = await apiFetch('/auctions');
    const current =
        auctions.find((auction) => auction.status === 'active') ||
        auctions.find((auction) => auction.status === 'paused') ||
        auctions.find((auction) => auction.status === 'pending') ||
        null;
    state.currentAuction = current;
    window._currentAuction = current;

    const container = $('current-auction-info');
    if (!container) {
        return;
    }

    if (!current) {
        container.innerHTML = `<p class="empty-msg">${state.lang === 'ar' ? 'لا يوجد مزاد الآن' : 'No auction yet'}</p>`;
        return;
    }

    container.innerHTML = `
        <div class="history-item">
            <div>
                <strong>${escapeHtml(current.itemName)}</strong>
                <div class="history-meta">${escapeHtml(getStatusLabel(current.status))} • ${formatDateTime(current.endAt || current.createdAt)}</div>
            </div>
            <div class="history-price">${formatMoney(current.currentPrice)}</div>
        </div>
    `;

    await loadAdminBidHistory(current.id);
}

async function loadAdminBidHistory(auctionId) {
    const history = $('auction-history');
    if (!history) {
        return;
    }

    const [auctions, bids] = await Promise.all([
        apiFetch('/auctions'),
        apiFetch(`/bids/${auctionId}`)
    ]);

    const auction = auctions.find((item) => item.id === auctionId);
    const endedAuctions = auctions.filter((item) => item.status === 'ended');

    const currentMarkup = auction ? `
        <div class="history-item">
            <div>
                <strong>${escapeHtml(auction.itemName)}</strong>
                <div class="history-meta">${escapeHtml(getStatusLabel(auction.status))}</div>
            </div>
            <div class="control-buttons">
                <button class="btn-danger" onclick="deleteAuction('${auction.id}')">${state.lang === 'ar' ? 'حذف' : 'Delete'}</button>
            </div>
        </div>
    ` : '';

    const bidsMarkup = bids.map((bid) => `
        <div class="history-item">
            <div>
                <strong>${escapeHtml(bid.bidderName)}</strong>
                <div class="history-meta">${formatDateTime(bid.createdAt)}</div>
            </div>
            <div class="history-price">${formatMoney(bid.amount)}</div>
        </div>
    `).join('');

    const endedMarkup = endedAuctions.map((item) => `
        <div class="history-item">
            <div>
                <strong>${escapeHtml(item.itemName)}</strong>
                <div class="history-meta">${escapeHtml(item.highestBidderName || '-')} • ${escapeHtml(item.winnerCode || '')}</div>
            </div>
            <div class="history-price">${formatMoney(item.currentPrice)}</div>
        </div>
    `).join('');

    history.innerHTML = currentMarkup + bidsMarkup + endedMarkup || `<p class="empty-msg">${state.lang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</p>`;
}

async function createAuction(event) {
    event.preventDefault();

    const itemName = $('auction-item-name')?.value.trim();
    const description = $('auction-item-desc')?.value.trim();
    const startPrice = Number($('auction-start-price')?.value || 0);
    const durationMinutes = Number($('auction-duration')?.value || 60);
    const minimumIncrement = Number($('auction-increment')?.value || 100);

    try {
        await apiFetch('/admin/create-auction', {
            method: 'POST',
            body: JSON.stringify({
                itemName,
                description,
                startPrice,
                durationMinutes,
                minimumIncrement
            })
        });

        event.target.reset();
        showToast(state.lang === 'ar' ? 'تم إنشاء المزاد' : 'Auction created');
        await refreshAdminCurrentAuction();
        await loadDashboard();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function setAuctionStatus(action) {
    if (!state.currentAuction) {
        showToast(state.lang === 'ar' ? 'اختر مزادًا أولًا' : 'No auction selected', 'error');
        return;
    }

    await apiFetch(`/admin/${action}-auction/${state.currentAuction.id}`, {
        method: 'POST',
        body: JSON.stringify({})
    });

    await refreshAdminCurrentAuction();
    await loadDashboard();
}

function startAuction() {
    return setAuctionStatus('start');
}

function pauseAuction() {
    return setAuctionStatus('pause');
}

function endAuction() {
    return setAuctionStatus('end');
}

async function extendAuction() {
    if (!state.currentAuction) {
        return;
    }

    await apiFetch(`/admin/extend-auction/${state.currentAuction.id}`, {
        method: 'POST',
        body: JSON.stringify({ minutes: 5 })
    });
    showToast(state.lang === 'ar' ? 'تم تمديد المزاد 5 دقائق' : 'Auction extended by 5 minutes');
    await refreshAdminCurrentAuction();
}

async function deleteAuction(id) {
    showModal(
        state.lang === 'ar' ? 'حذف المزاد' : 'Delete auction',
        `<p>${state.lang === 'ar' ? 'سيتم حذف المزاد وكل مزايداته.' : 'This will delete the auction and all related bids.'}</p>`,
        async () => {
            await apiFetch(`/admin/auctions/${id}`, { method: 'DELETE' });
            showToast(state.lang === 'ar' ? 'تم حذف المزاد' : 'Auction deleted');
            await refreshAdminCurrentAuction();
            await loadDashboard();
        },
        state.lang === 'ar' ? 'حذف' : 'Delete'
    );
}

async function loadAuctionTab() {
    await refreshAdminCurrentAuction();
}

async function loadAdminMessages() {
    const messages = await apiFetch('/messages?all=1');
    const container = $('admin-messages-list');

    if (!container) {
        return;
    }

    container.innerHTML = messages.length
        ? messages.slice().reverse().map((message) => `
            <div class="history-item">
                <div>
                    <strong>${escapeHtml(message.senderName)}</strong>
                    <div class="history-meta">${formatDateTime(message.createdAt)}</div>
                </div>
                <div>${escapeHtml(message.content)}</div>
            </div>
        `).join('')
        : `<p class="empty-msg">${state.lang === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>`;
}

async function sendBroadcast(event) {
    event.preventDefault();
    const message = $('broadcast-msg')?.value.trim();

    try {
        await apiFetch('/broadcast', {
            method: 'POST',
            body: JSON.stringify({ content: message })
        });

        $('broadcast-msg').value = '';
        showToast(state.lang === 'ar' ? 'تم إرسال الرسالة الجماعية' : 'Broadcast sent');
        await loadAdminMessages();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadSettings() {
    const settings = await apiFetch('/admin/settings');
    $('setting-site-name') && ($('setting-site-name').value = settings.siteName || DEFAULT_SITE_NAME);
    $('setting-welcome-msg') && ($('setting-welcome-msg').value = settings.welcomeMessage || '');
}

async function saveSettings(event) {
    event.preventDefault();

    try {
        await apiFetch('/admin/settings', {
            method: 'POST',
            body: JSON.stringify({
                siteName: $('setting-site-name')?.value.trim(),
                welcomeMessage: $('setting-welcome-msg')?.value.trim()
            })
        });

        showToast(state.lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function exportData() {
    const payload = await apiFetch('/admin/export');
    downloadJson('alnisr-export.json', payload);
}

async function backupDatabase() {
    const payload = await apiFetch('/admin/export');
    downloadJson(`alnisr-backup-${Date.now()}.json`, payload);
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function clearAllData() {
    showModal(
        state.lang === 'ar' ? 'مسح البيانات' : 'Clear data',
        `<p>${state.lang === 'ar' ? 'سيتم حذف جميع المستخدمين والمزادات والمزايدات والرسائل.' : 'This will erase all users, auctions, bids, and messages.'}</p>`,
        async () => {
            await apiFetch('/admin/clear-all', {
                method: 'POST',
                body: JSON.stringify({})
            });
            showToast(state.lang === 'ar' ? 'تم مسح البيانات' : 'Data cleared');
            await loadAdminData();
        },
        state.lang === 'ar' ? 'مسح' : 'Clear'
    );
}

async function loadAdminData() {
    await Promise.all([
        loadDashboard(),
        loadMembersData(),
        refreshAdminCurrentAuction(),
        loadAdminMessages(),
        loadSettings()
    ]);
    showAdminTab('dashboard');
}

async function initAuctionPage() {
    await checkAuctionAuth();
    await refreshAuction();
    setPageInterval(refreshAuction, 5000);
}

async function initProfilePage() {
    await loadMemberProfile();
}

async function initAdminPage() {
    showAdminPanel(state.adminLoggedIn);
    if (state.adminLoggedIn) {
        await loadAdminData();
    }
}

async function initChatPageSupport() {
    await primeCurrentAuction();
}

window.toggleLanguage = toggleLanguage;
window.applyLang = applyLang;
window.initDB = initDB;
window.dbGetAll = dbGetAll;
window.dbPut = dbPut;
window.dbDelete = dbDelete;
window.initWebSocket = initWebSocket;
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.showTab = showTab;
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.logout = logout;
window.checkAuctionAuth = checkAuctionAuth;
window.refreshAuction = refreshAuction;
window.refreshBidHistory = refreshBidHistory;
window.placeBid = placeBid;
window.quickBid = quickBid;
window.loadMemberProfile = loadMemberProfile;
window.handleAdminLogin = handleAdminLogin;
window.adminLogout = adminLogout;
window.showAdminTab = showAdminTab;
window.loadDashboard = loadDashboard;
window.loadMembersData = loadMembersData;
window.renderPendingMembers = renderPendingMembers;
window.renderApprovedMembers = renderApprovedMembers;
window.viewMemberBids = viewMemberBids;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.deleteUser = deleteUser;
window.refreshAdminCurrentAuction = refreshAdminCurrentAuction;
window.loadAdminBidHistory = loadAdminBidHistory;
window.createAuction = createAuction;
window.startAuction = startAuction;
window.pauseAuction = pauseAuction;
window.endAuction = endAuction;
window.extendAuction = extendAuction;
window.deleteAuction = deleteAuction;
window.loadAuctionTab = loadAuctionTab;
window.loadAdminMessages = loadAdminMessages;
window.sendBroadcast = sendBroadcast;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.exportData = exportData;
window.backupDatabase = backupDatabase;
window.clearAllData = clearAllData;

document.addEventListener('DOMContentLoaded', async () => {
    applyLang();
    initWebSocket();

    try {
        await primeCurrentAuction();
    } catch (error) {
        console.error('Initial auction load error:', error);
    }

    if (isPage('auction.html')) {
        await initAuctionPage();
    }

    if (isPage('profile.html')) {
        await initProfilePage();
    }

    if (isPage('admin.html')) {
        await initAdminPage();
    }

    if (isPage('chat.html')) {
        await initChatPageSupport();
    }
});
