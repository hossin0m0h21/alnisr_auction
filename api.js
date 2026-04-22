// غير برابط Backend الخاص بك من Render
const BACKEND_HOST = 'your-alnisr-app.onrender.com'; // ✏️ غير هنا برابطك من Render

const API_URL = (() => {
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3000/api';
        }
        return `https://${BACKEND_HOST}/api`;
    }
    return 'http://localhost:3000/api';
})();

const WS_URL = (() => {
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost') {
            return 'ws://localhost:3000';
        }
        return `wss://${BACKEND_HOST}`;
    }
    return 'ws://localhost:3000';
})();

console.log('API:', API_URL);

let ws = null;
let wsCallbacks = {};

export async function initWebSocket() {
    return new Promise((resolve) => {
        try {
            ws = new WebSocket(WS_URL);
            ws.onopen = () => {
                console.log('WebSocket connected');
                resolve();
            };
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (wsCallbacks[data.type]) {
                    wsCallbacks[data.type](data);
                }
            };
            ws.onerror = () => {
                console.log('WebSocket error, will use polling');
                resolve();
            };
            ws.onclose = () => {
                console.log('WebSocket closed');
                setTimeout(initWebSocket, 3000);
            };
        } catch (e) {
            console.log('WebSocket not available, using polling');
            resolve();
        }
    });
}

export function onWebSocketEvent(type, callback) {
    wsCallbacks[type] = callback;
}

export async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return await res.json();
    } catch (e) {
        console.error(`API Error: ${endpoint}`, e);
        return { error: e.message };
    }
}

export async function registerUser(fullname, phone, password) {
    return apiCall('/register', 'POST', { fullname, phone, password });
}

export async function loginUser(id, password) {
    return apiCall('/login', 'POST', { id, password });
}

export async function getAuctions() {
    return apiCall('/auctions');
}

export async function placeBid(auctionId, userId, userName, amount) {
    return apiCall('/bid', 'POST', { auctionId, userId, userName, amount });
}

export async function getBids(auctionId) {
    return apiCall(`/bids/${auctionId}`);
}

export async function getUserBids(userId) {
    return apiCall(`/user-bids/${userId}`);
}

export async function getUser(userId) {
    return apiCall(`/user/${userId}`);
}

export async function adminLogin(password) {
    return apiCall('/admin/login', 'POST', { password });
}

export async function getUsers() {
    return apiCall('/admin/users');
}

export async function approveUser(userId) {
    return apiCall(`/admin/approve-user/${userId}`, 'POST');
}

export async function createAuction(itemName, description, startPrice, date, mediaType, mediaUrl) {
    return apiCall('/admin/create-auction', 'POST', { itemName, description, startPrice, date, mediaType, mediaUrl });
}

export async function startAuction(auctionId) {
    return apiCall(`/admin/start-auction/${auctionId}`, 'POST');
}

export async function endAuction(auctionId) {
    return apiCall(`/admin/end-auction/${auctionId}`, 'POST');
}

export async function getNotifications(userId) {
    return apiCall(`/notifications/${userId}`);
}

export async function markNotificationRead(userId, notifId) {
    return apiCall(`/notifications/${userId}/mark-read/${notifId}`, 'POST');
}

export async function getStats() {
    return apiCall('/stats');
}

export default {
    initWebSocket,
    onWebSocketEvent,
    apiCall,
    registerUser,
    loginUser,
    getAuctions,
    placeBid,
    getBids,
    getUserBids,
    getUser,
    adminLogin,
    getUsers,
    approveUser,
    createAuction,
    startAuction,
    endAuction,
    getNotifications,
    markNotificationRead,
    getStats
};
