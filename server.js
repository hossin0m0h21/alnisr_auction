import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, '.data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const DEFAULT_SITE_NAME = 'ALNISR';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function nowIso() {
    return new Date().toISOString();
}

function makeId(prefix) {
    return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

function createDefaultSettings() {
    return {
        siteName: DEFAULT_SITE_NAME,
        welcomeMessage: 'Welcome to ALNISR Auction',
        bidIncrement: 100,
        auctionDuration: 60,
        adminPasswordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10),
        updatedAt: nowIso()
    };
}

function createDefaultStore() {
    return {
        settings: createDefaultSettings(),
        users: [],
        auctions: [],
        bids: [],
        messages: [],
        notifications: []
    };
}

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(STORE_FILE)) {
        fs.writeFileSync(STORE_FILE, JSON.stringify(createDefaultStore(), null, 2));
    }
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeStore(rawStore) {
    const fallback = createDefaultStore();
    const rawSettings = rawStore?.settings || {};
    const settings = {
        ...fallback.settings,
        ...rawSettings
    };

    if (!settings.adminPasswordHash) {
        if (rawSettings.adminPassword) {
            settings.adminPasswordHash = bcrypt.hashSync(rawSettings.adminPassword, 10);
        } else {
            settings.adminPasswordHash = fallback.settings.adminPasswordHash;
        }
    }

    if (process.env.ADMIN_PASSWORD) {
        settings.adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    }

    const users = ensureArray(rawStore?.users).map((user, index) => ({
        id: user.id || user._id || makeId('usr'),
        memberId: user.memberId || `AL-${String(index + 1001).padStart(4, '0')}`,
        fullname: user.fullname || user.fullName || 'Member',
        phone: user.phone || '',
        passwordHash: user.passwordHash || user.password || '',
        status: user.status || 'pending',
        createdAt: user.createdAt || nowIso()
    }));

    const auctions = ensureArray(rawStore?.auctions).map((auction) => ({
        id: auction.id || auction._id || makeId('auc'),
        itemName: auction.itemName || 'Auction Item',
        description: auction.description || '',
        startPrice: Number(auction.startPrice || 0),
        currentPrice: Number(auction.currentPrice ?? auction.startPrice ?? 0),
        minimumIncrement: Number(
            auction.minimumIncrement ??
            auction.increment ??
            settings.bidIncrement ??
            100
        ),
        durationMinutes: Number(
            auction.durationMinutes ??
            auction.duration ??
            settings.auctionDuration ??
            60
        ),
        status: auction.status || 'pending',
        createdAt: auction.createdAt || nowIso(),
        startedAt: auction.startedAt || null,
        endAt: auction.endAt || auction.endTime || null,
        endedAt: auction.endedAt || null,
        highestBidderId: auction.highestBidderId || null,
        highestBidderName: auction.highestBidderName || auction.highestBidder || null,
        winnerCode: auction.winnerCode || null,
        paymentStatus: auction.paymentStatus || 'pending',
        paymentMethod: auction.paymentMethod || 'manual',
        media: Array.isArray(auction.media) ? auction.media : [],
        sellerApproved: auction.sellerApproved ?? null
    }));

    const bids = ensureArray(rawStore?.bids).map((bid) => ({
        id: bid.id || bid._id || makeId('bid'),
        auctionId: bid.auctionId,
        userId: bid.userId,
        bidderName: bid.bidderName || bid.userName || 'Member',
        amount: Number(bid.amount || 0),
        createdAt: bid.createdAt || nowIso()
    }));

    const messages = ensureArray(rawStore?.messages).map((message) => ({
        id: message.id || message._id || makeId('msg'),
        senderId: message.senderId || 'system',
        senderName: message.senderName || 'System',
        auctionId: message.auctionId || null,
        content: message.content || '',
        type: message.type || 'chat',
        createdAt: message.createdAt || nowIso()
    }));

    const notifications = ensureArray(rawStore?.notifications).map((notification) => ({
        id: notification.id || notification._id || makeId('ntf'),
        userId: notification.userId,
        message: notification.message || '',
        type: notification.type || 'info',
        read: Boolean(notification.read),
        createdAt: notification.createdAt || nowIso()
    }));

    return { settings, users, auctions, bids, messages, notifications };
}

function readStoreFromDisk() {
    ensureDataFile();

    try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        return normalizeStore(JSON.parse(raw));
    } catch (error) {
        console.error('Failed to read store, rebuilding a clean file.', error);
        const cleanStore = createDefaultStore();
        fs.writeFileSync(STORE_FILE, JSON.stringify(cleanStore, null, 2));
        return normalizeStore(cleanStore);
    }
}

let store = readStoreFromDisk();

function writeStore() {
    store.settings.updatedAt = nowIso();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function withLegacyId(record) {
    return record ? { ...record, _id: record.id } : record;
}

function sanitizeUser(user) {
    return withLegacyId({
        id: user.id,
        memberId: user.memberId,
        fullname: user.fullname,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt
    });
}

function sanitizeAuction(auction) {
    const bidsCount = store.bids.filter((bid) => bid.auctionId === auction.id).length;
    return withLegacyId({
        ...auction,
        bidsCount
    });
}

function sanitizeBid(bid) {
    return withLegacyId({ ...bid });
}

function sanitizeMessage(message) {
    return withLegacyId({ ...message });
}

function publicSettings() {
    return {
        siteName: store.settings.siteName,
        welcomeMessage: store.settings.welcomeMessage,
        bidIncrement: Number(store.settings.bidIncrement || 100),
        auctionDuration: Number(store.settings.auctionDuration || 60),
        updatedAt: store.settings.updatedAt
    };
}

function getAdminToken() {
    return crypto
        .createHash('sha256')
        .update(store.settings.adminPasswordHash)
        .digest('hex');
}

function generateMemberId() {
    const numbers = store.users
        .map((user) => Number(String(user.memberId || '').replace(/\D/g, '')))
        .filter((value) => Number.isFinite(value));
    const next = numbers.length ? Math.max(...numbers) + 1 : 1001;
    return `AL-${String(next).padStart(4, '0')}`;
}

function generateWinnerCode() {
    return `WIN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function findUser(userId) {
    return store.users.find((user) => user.id === userId || user.memberId === userId);
}

function findAuction(auctionId) {
    return store.auctions.find((auction) => auction.id === auctionId || auction._id === auctionId);
}

function createNotification(userId, message, type = 'info') {
    const notification = {
        id: makeId('ntf'),
        userId,
        message,
        type,
        read: false,
        createdAt: nowIso()
    };

    store.notifications.push(notification);
    return notification;
}

function addSystemMessage(content, auctionId = null, type = 'system') {
    const message = {
        id: makeId('msg'),
        senderId: 'system',
        senderName: 'System',
        auctionId,
        content,
        type,
        createdAt: nowIso()
    };

    store.messages.push(message);
    return message;
}

function broadcastEvent(type, data = {}) {
    const payload = JSON.stringify({ type, data });

    for (const client of wss.clients) {
        if (client.readyState === 1) {
            client.send(payload);
        }
    }
}

function finalizeAuction(auction, reason = 'manual') {
    auction.status = 'ended';
    auction.endedAt = nowIso();

    if (auction.highestBidderId && !auction.winnerCode) {
        auction.winnerCode = generateWinnerCode();
        auction.paymentStatus = 'pending';
        const winner = findUser(auction.highestBidderId);
        if (winner) {
            createNotification(
                winner.id,
                `You won ${auction.itemName} with ${auction.currentPrice} AED`,
                'success'
            );
        }
    } else if (!auction.highestBidderId) {
        auction.paymentStatus = 'not_required';
    }

    addSystemMessage(
        `Auction ended: ${auction.itemName}${reason === 'expired' ? ' (time finished)' : ''}`,
        auction.id,
        'system'
    );
}

function closeExpiredAuctions() {
    const now = Date.now();
    let changed = false;

    for (const auction of store.auctions) {
        if (auction.status === 'active' && auction.endAt && new Date(auction.endAt).getTime() <= now) {
            finalizeAuction(auction, 'expired');
            changed = true;
        }
    }

    if (changed) {
        writeStore();
        broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });
        broadcastEvent('message_created', { messages: store.messages.slice(-10).map(sanitizeMessage) });
    }
}

function buildPayments() {
    return store.auctions
        .filter((auction) => auction.status === 'ended' && auction.winnerCode)
        .map((auction) => ({
            id: `pay_${auction.id}`,
            _id: `pay_${auction.id}`,
            winnerCode: auction.winnerCode,
            amount: auction.currentPrice,
            status: auction.paymentStatus || 'pending',
            paymentMethod: auction.paymentMethod || 'manual',
            createdAt: auction.endedAt || auction.createdAt
        }));
}

function buildWinners() {
    return store.auctions
        .filter((auction) => auction.status === 'ended' && auction.highestBidderId)
        .map((auction) => ({
            id: `win_${auction.id}`,
            _id: `win_${auction.id}`,
            auctionId: auction.id,
            winnerName: auction.highestBidderName,
            finalBidAmount: auction.currentPrice,
            winnerCode: auction.winnerCode || '',
            paymentStatus: auction.paymentStatus || 'pending',
            createdAt: auction.endedAt || auction.createdAt
        }));
}

function buildStats() {
    const approvedUsers = store.users.filter((user) => user.status === 'approved');
    const pendingUsers = store.users.filter((user) => user.status === 'pending');
    const activeAuctions = store.auctions.filter((auction) => auction.status === 'active');
    const endedAuctions = store.auctions.filter((auction) => auction.status === 'ended');
    const totalRevenue = endedAuctions.reduce((sum, auction) => sum + Number(auction.currentPrice || 0), 0);

    return {
        pendingUsers: pendingUsers.length,
        approvedUsers: approvedUsers.length,
        totalUsers: store.users.length,
        activeAuctions: activeAuctions.length,
        totalAuctions: store.auctions.length,
        totalBids: store.bids.length,
        totalRevenue
    };
}

app.use((req, res, next) => {
    const origin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }

    next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
    closeExpiredAuctions();
    res.json({
        ok: true,
        timestamp: nowIso(),
        stats: buildStats()
    });
});

app.get('/api/stats', (_req, res) => {
    closeExpiredAuctions();
    res.json(buildStats());
});

app.get('/api/public/users', (_req, res) => {
    res.json(store.users.map(sanitizeUser));
});

app.post('/api/register', (req, res) => {
    const fullname = String(req.body.fullname || '').trim();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!fullname || !phone || password.length < 6) {
        res.status(400).json({ message: 'Please provide a valid name, phone, and password.' });
        return;
    }

    const duplicate = store.users.find((user) => user.phone === phone);
    if (duplicate) {
        res.status(409).json({ message: 'This phone number is already registered.' });
        return;
    }

    const user = {
        id: makeId('usr'),
        memberId: generateMemberId(),
        fullname,
        phone,
        passwordHash: bcrypt.hashSync(password, 10),
        status: 'pending',
        createdAt: nowIso()
    };

    store.users.push(user);
    addSystemMessage(`New member registration: ${fullname}`, null, 'system');
    writeStore();
    broadcastEvent('users_changed', { users: store.users.map(sanitizeUser) });

    res.status(201).json({
        success: true,
        message: 'Registration submitted. Waiting for admin approval.',
        user: sanitizeUser(user)
    });
});

app.post('/api/login', (req, res) => {
    const identifier = String(req.body.identifier || req.body.loginId || '').trim();
    const password = String(req.body.password || '');
    const user = store.users.find(
        (entry) => entry.phone === identifier || entry.memberId === identifier
    );

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        res.status(401).json({ message: 'Invalid login details.' });
        return;
    }

    if (user.status !== 'approved') {
        res.status(403).json({ message: 'Your account is still waiting for admin approval.' });
        return;
    }

    res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/api/admin/login', (req, res) => {
    const password = String(req.body.password || '');
    const valid = bcrypt.compareSync(password, store.settings.adminPasswordHash);

    if (!valid) {
        res.status(401).json({ message: 'Wrong admin password.' });
        return;
    }

    res.json({
        success: true,
        token: getAdminToken(),
        settings: publicSettings()
    });
});

function requireAdmin(req, res, next) {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = String(req.headers['x-admin-token'] || bearer || '').trim();

    if (!token || token !== getAdminToken()) {
        res.status(401).json({ message: 'Admin authentication required.' });
        return;
    }

    next();
}

app.get('/api/auctions', (_req, res) => {
    closeExpiredAuctions();
    const auctions = [...store.auctions]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map(sanitizeAuction);
    res.json(auctions);
});

app.get('/api/bids', (req, res) => {
    const auctionId = String(req.query.auctionId || '').trim();
    const bids = store.bids
        .filter((bid) => !auctionId || bid.auctionId === auctionId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map(sanitizeBid);
    res.json(bids);
});

app.get('/api/bids/:auctionId', (req, res) => {
    const bids = store.bids
        .filter((bid) => bid.auctionId === req.params.auctionId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map(sanitizeBid);
    res.json(bids);
});

app.post('/api/bid', (req, res) => {
    closeExpiredAuctions();

    const auction = findAuction(String(req.body.auctionId || ''));
    const user = findUser(String(req.body.userId || ''));
    const amount = Number(req.body.amount || 0);

    if (!auction) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    if (!user || user.status !== 'approved') {
        res.status(403).json({ message: 'Only approved users can bid.' });
        return;
    }

    if (auction.status !== 'active') {
        res.status(400).json({ message: 'This auction is not active right now.' });
        return;
    }

    const minimumAllowed = Number(auction.currentPrice || auction.startPrice || 0) + Number(auction.minimumIncrement || 0);
    if (!Number.isFinite(amount) || amount < minimumAllowed) {
        res.status(400).json({
            message: `Bid must be at least ${minimumAllowed} AED.`
        });
        return;
    }

    const bid = {
        id: makeId('bid'),
        auctionId: auction.id,
        userId: user.id,
        bidderName: user.fullname,
        amount,
        createdAt: nowIso()
    };

    auction.currentPrice = amount;
    auction.highestBidderId = user.id;
    auction.highestBidderName = user.fullname;

    store.bids.push(bid);
    addSystemMessage(`${user.fullname} placed ${amount} AED on ${auction.itemName}`, auction.id, 'system');
    writeStore();

    broadcastEvent('bid_placed', {
        auction: sanitizeAuction(auction),
        bid: sanitizeBid(bid)
    });
    broadcastEvent('message_created', { messages: store.messages.slice(-10).map(sanitizeMessage) });

    res.status(201).json({
        success: true,
        auction: sanitizeAuction(auction),
        bid: sanitizeBid(bid)
    });
});

app.get('/api/user/:id', (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        res.status(404).json({ message: 'User not found.' });
        return;
    }

    res.json(sanitizeUser(user));
});

app.get('/api/user-bids/:userId', (req, res) => {
    const userId = req.params.userId;
    const bids = store.bids
        .filter((bid) => bid.userId === userId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map((bid) => {
            const auction = findAuction(bid.auctionId);
            return {
                ...sanitizeBid(bid),
                auction: auction ? sanitizeAuction(auction) : null
            };
        });

    res.json(bids);
});

app.get('/api/messages', (req, res) => {
    const auctionId = String(req.query.auctionId || '').trim();
    const includeAll = String(req.query.all || '').trim() === '1';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = String(req.headers['x-admin-token'] || bearer || '').trim();

    if (includeAll && token !== getAdminToken()) {
        res.status(401).json({ message: 'Admin authentication required.' });
        return;
    }

    const messages = store.messages
        .filter((message) => includeAll || !auctionId || message.auctionId === auctionId || message.type === 'broadcast')
        .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
        .slice(-100)
        .map(sanitizeMessage);

    res.json(messages);
});

app.post('/api/messages/send', (req, res) => {
    const senderId = String(req.body.senderId || '').trim();
    const senderName = String(req.body.senderName || 'Member').trim();
    const content = String(req.body.content || '').trim();
    const auctionId = String(req.body.auctionId || '').trim() || null;

    if (!senderId || !content) {
        res.status(400).json({ message: 'Message sender and content are required.' });
        return;
    }

    const message = {
        id: makeId('msg'),
        senderId,
        senderName,
        auctionId,
        content,
        type: 'chat',
        createdAt: nowIso()
    };

    store.messages.push(message);
    writeStore();
    broadcastEvent('message_created', { message: sanitizeMessage(message) });

    res.status(201).json({ success: true, message: sanitizeMessage(message) });
});

app.post('/api/broadcast', requireAdmin, (req, res) => {
    const content = String(req.body.content || req.body.message || '').trim();

    if (!content) {
        res.status(400).json({ message: 'Broadcast message cannot be empty.' });
        return;
    }

    const message = {
        id: makeId('msg'),
        senderId: 'admin',
        senderName: 'Admin',
        auctionId: null,
        content,
        type: 'broadcast',
        createdAt: nowIso()
    };

    store.messages.push(message);
    for (const user of store.users) {
        createNotification(user.id, content, 'broadcast');
    }

    writeStore();
    broadcastEvent('broadcast_sent', { message: sanitizeMessage(message) });

    res.status(201).json({ success: true, message: sanitizeMessage(message) });
});

app.get('/api/notifications/:userId', (req, res) => {
    const notifications = store.notifications
        .filter((notification) => notification.userId === req.params.userId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map(withLegacyId);
    res.json(notifications);
});

app.post('/api/notifications/:userId/mark-read/:id', (req, res) => {
    const notification = store.notifications.find(
        (entry) => entry.userId === req.params.userId && entry.id === req.params.id
    );

    if (!notification) {
        res.status(404).json({ message: 'Notification not found.' });
        return;
    }

    notification.read = true;
    writeStore();
    res.json({ success: true, notification: withLegacyId(notification) });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const users = [...store.users]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map(sanitizeUser);
    res.json(users);
});

app.post('/api/admin/approve-user/:id', requireAdmin, (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        res.status(404).json({ message: 'User not found.' });
        return;
    }

    user.status = 'approved';
    createNotification(user.id, 'Your account is approved. You can now join the auction.', 'success');
    writeStore();
    broadcastEvent('users_changed', { users: store.users.map(sanitizeUser) });

    res.json({ success: true, user: sanitizeUser(user) });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const before = store.users.length;
    store.users = store.users.filter((user) => user.id !== req.params.id && user.memberId !== req.params.id);
    store.notifications = store.notifications.filter((notification) => notification.userId !== req.params.id);

    if (store.users.length === before) {
        res.status(404).json({ message: 'User not found.' });
        return;
    }

    writeStore();
    broadcastEvent('users_changed', { users: store.users.map(sanitizeUser) });
    res.json({ success: true });
});

app.post('/api/admin/create-auction', requireAdmin, (req, res) => {
    const itemName = String(req.body.itemName || '').trim();
    const description = String(req.body.description || '').trim();
    const startPrice = Number(req.body.startPrice || 0);
    const durationMinutes = Number(
        req.body.durationMinutes ||
        req.body.duration ||
        store.settings.auctionDuration ||
        60
    );
    const minimumIncrement = Number(
        req.body.minimumIncrement ||
        req.body.increment ||
        store.settings.bidIncrement ||
        100
    );

    if (!itemName || !Number.isFinite(startPrice) || startPrice < 0) {
        res.status(400).json({ message: 'Item name and a valid starting price are required.' });
        return;
    }

    const auction = {
        id: makeId('auc'),
        itemName,
        description,
        startPrice,
        currentPrice: startPrice,
        minimumIncrement,
        durationMinutes,
        status: 'pending',
        createdAt: nowIso(),
        startedAt: null,
        endAt: null,
        endedAt: null,
        highestBidderId: null,
        highestBidderName: null,
        winnerCode: null,
        paymentStatus: 'pending',
        paymentMethod: 'manual',
        media: []
    };

    store.auctions.unshift(auction);
    addSystemMessage(`Auction created: ${auction.itemName}`, auction.id, 'system');
    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });

    res.status(201).json({ success: true, id: auction.id, auction: sanitizeAuction(auction) });
});

app.post('/api/admin/start-auction/:id', requireAdmin, (req, res) => {
    const auction = findAuction(req.params.id);

    if (!auction) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    for (const current of store.auctions) {
        if (current.id !== auction.id && current.status === 'active') {
            current.status = 'paused';
        }
    }

    auction.status = 'active';
    auction.startedAt = nowIso();
    auction.endAt = new Date(Date.now() + Number(auction.durationMinutes || 60) * 60 * 1000).toISOString();
    addSystemMessage(`Auction started: ${auction.itemName}`, auction.id, 'system');
    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });

    res.json({ success: true, auction: sanitizeAuction(auction) });
});

app.post('/api/admin/pause-auction/:id', requireAdmin, (req, res) => {
    const auction = findAuction(req.params.id);

    if (!auction) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    auction.status = 'paused';
    addSystemMessage(`Auction paused: ${auction.itemName}`, auction.id, 'system');
    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });

    res.json({ success: true, auction: sanitizeAuction(auction) });
});

app.post('/api/admin/end-auction/:id', requireAdmin, (req, res) => {
    const auction = findAuction(req.params.id);

    if (!auction) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    finalizeAuction(auction, 'manual');
    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });
    broadcastEvent('message_created', { messages: store.messages.slice(-10).map(sanitizeMessage) });

    res.json({ success: true, auction: sanitizeAuction(auction) });
});

app.post('/api/admin/extend-auction/:id', requireAdmin, (req, res) => {
    const auction = findAuction(req.params.id);
    const extraMinutes = Number(req.body.minutes || 5);

    if (!auction) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    const baseTime = auction.endAt ? new Date(auction.endAt).getTime() : Date.now();
    auction.endAt = new Date(baseTime + extraMinutes * 60 * 1000).toISOString();
    if (auction.status === 'pending') {
        auction.status = 'active';
        auction.startedAt = auction.startedAt || nowIso();
    }

    addSystemMessage(`Auction extended by ${extraMinutes} minutes: ${auction.itemName}`, auction.id, 'system');
    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });

    res.json({ success: true, auction: sanitizeAuction(auction) });
});

app.delete('/api/admin/auctions/:id', requireAdmin, (req, res) => {
    const before = store.auctions.length;
    store.auctions = store.auctions.filter((auction) => auction.id !== req.params.id);
    store.bids = store.bids.filter((bid) => bid.auctionId !== req.params.id);
    store.messages = store.messages.filter((message) => message.auctionId !== req.params.id);

    if (store.auctions.length === before) {
        res.status(404).json({ message: 'Auction not found.' });
        return;
    }

    writeStore();
    broadcastEvent('auction_sync', { auctions: store.auctions.map(sanitizeAuction) });

    res.json({ success: true });
});

app.get('/api/admin/payments', requireAdmin, (_req, res) => {
    res.json(buildPayments());
});

app.get('/api/admin/winners', requireAdmin, (_req, res) => {
    res.json(buildWinners());
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    res.json(publicSettings());
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
    const siteName = String(req.body.siteName || store.settings.siteName || DEFAULT_SITE_NAME).trim();
    const welcomeMessage = String(req.body.welcomeMessage || store.settings.welcomeMessage || '').trim();
    const bidIncrement = Number(req.body.bidIncrement || store.settings.bidIncrement || 100);
    const auctionDuration = Number(req.body.auctionDuration || store.settings.auctionDuration || 60);
    const adminPassword = String(req.body.adminPassword || '').trim();

    store.settings.siteName = siteName || DEFAULT_SITE_NAME;
    store.settings.welcomeMessage = welcomeMessage;
    store.settings.bidIncrement = Number.isFinite(bidIncrement) ? bidIncrement : 100;
    store.settings.auctionDuration = Number.isFinite(auctionDuration) ? auctionDuration : 60;

    if (adminPassword) {
        store.settings.adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
    }

    writeStore();
    broadcastEvent('settings_changed', { settings: publicSettings() });

    res.json({ success: true, settings: publicSettings() });
});

app.get('/api/admin/export', requireAdmin, (_req, res) => {
    res.json({
        exportedAt: nowIso(),
        data: {
            ...store,
            users: store.users.map(sanitizeUser)
        }
    });
});

app.post('/api/admin/clear-all', requireAdmin, (_req, res) => {
    const preservedSettings = { ...store.settings };
    store = {
        settings: preservedSettings,
        users: [],
        auctions: [],
        bids: [],
        messages: [],
        notifications: []
    };

    writeStore();
    broadcastEvent('store_reset', { success: true });

    res.json({ success: true });
});

app.use('/uploads', express.static(path.join(ROOT_DIR, 'uploads')));
app.use(express.static(ROOT_DIR));

app.get('/api/*', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
});

app.get('*', (req, res) => {
    const cleanedPath = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
    const filePath = path.join(ROOT_DIR, cleanedPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
        return;
    }

    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

wss.on('connection', (socket) => {
    socket.send(JSON.stringify({
        type: 'connected',
        data: {
            timestamp: nowIso(),
            stats: buildStats()
        }
    }));
});

setInterval(closeExpiredAuctions, 15000);

server.listen(PORT, () => {
    console.log(`ALNISR server is running on port ${PORT}`);
    console.log(`Data store: ${STORE_FILE}`);
});
