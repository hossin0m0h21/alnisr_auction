import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { initDB, findAllAuctions, findUser, createUser, findAllUsers, findAuction, createBid, findAllBids, updateAuction, updateUser, findNotifications, Auction, Bid, Notification, Message } from './database.js';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const NODE_ENV = process.env.NODE_ENV || 'development';
let clients = new Set();
let auctionTimers = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov|pdf/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext || mime) cb(null, true);
        else cb(new Error('نوع الملف غير مدعوم'));
    }
});

function startAuctionTimer(auctionId, endTime) {
    const timeRemaining = new Date(endTime) - new Date();
    if (timeRemaining <= 0) return;
    
    if (auctionTimers.has(auctionId)) {
        clearInterval(auctionTimers.get(auctionId));
    }
    
    const timer = setInterval(async () => {
        const currentTime = new Date();
        const remaining = new Date(endTime) - currentTime;
        
        if (remaining <= 0) {
            clearInterval(timer);
            auctionTimers.delete(auctionId);
            await updateAuction(auctionId, { status: 'ended' });
            broadcast({ type: 'AUCTION_ENDED', auctionId, winner: true });
            return;
        }
        
        broadcast({ 
            type: 'TIMER_UPDATE', 
            auctionId, 
            timeRemaining: remaining,
            endTime: endTime 
        });
    }, 1000);
    
    auctionTimers.set(auctionId, timer);
}

// ===== الأمان =====
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// ===== Rate Limiting =====
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'عدد كبير من الطلبات'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'حاول لاحقاً'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ===== دالة البث الفوري =====
function broadcast(data) {
    clients.forEach(ws => {
        if (ws.readyState === 1) ws.send(JSON.stringify(data));
    });
}

// ===== اتصال WebSocket =====
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('عميل جديد متصل. العدد الكلي:', clients.size);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('عميل قطع الاتصال. العدد الكلي:', clients.size);
    });
    
    ws.on('error', (error) => {
        console.error('خطأ WebSocket:', error);
        clients.delete(ws);
    });
});

// ===== الـ APIs =====

// الحصول على جميع المزادات
app.get('/api/auctions', async (req, res) => {
    try {
        const auctions = await findAllAuctions();
        res.json(auctions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// التسجيل
app.post('/api/register', authLimiter, async (req, res) => {
    const { fullname, phone, password } = req.body;
    try {
        // التحقق من البيانات
        if (!fullname || !phone || !password) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }
        
        if (fullname.split(' ').filter(w => w).length < 3) {
            return res.status(400).json({ error: 'الاسم الكامل يجب أن يكون ثلاث كلمات على الأقل' });
        }
        
        if (!validator.isMobilePhone(phone, 'ar-SA')) {
            return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }
        
        const existing = await findUser({ phone });
        if (existing) return res.status(400).json({ error: 'رقم الهاتف مسجل بالفعل' });

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await createUser({
            phone,
            fullname,
            password: hashedPassword,
            status: 'pending',
            createdAt: new Date()
        });
        
        broadcast({ type: 'NEW_MEMBER', userId: newUser._id });
        res.json({ id: newUser._id, message: 'التسجيل في انتظار الموافقة' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// تسجيل الدخول
app.post('/api/login', authLimiter, async (req, res) => {
    const { id, password } = req.body;
    try {
        if (!id || !password) {
            return res.status(400).json({ error: 'رقم الهاتف/المعرف وكلمة المرور مطلوبة' });
        }

        let user;
        
        // البحث عن المستخدم بـ ID أو الهاتف
        if (mongoose.Types.ObjectId.isValid(id)) {
            user = await findUser({ _id: id, status: 'approved' });
        }
        
        if (!user) {
            user = await findUser({ phone: id, status: 'approved' });
        }
        
        if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        
        // التحقق من كلمة المرور
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        
        // إرجاع بيانات بدون كلمة المرور
        const { password: _, ...userWithoutPassword } = user.toObject ? user.toObject() : user;
        res.json(userWithoutPassword);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الحصول على بيانات المستخدم
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await findUser({ _id: req.params.id });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // إرجاع بيانات محدودة بدون كلمة المرور
        const { password, ...userData } = user;
        res.json(userData);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// المزايدة
app.post('/api/bid', limiter, async (req, res) => {
    const { auctionId, userId, userName, amount } = req.body;
    try {
        // التحقق من البيانات
        if (!auctionId || !userId || !amount) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'المبلغ يجب أن يكون رقم موجب' });
        }

        const auction = await findAuction({ _id: auctionId });
        if (!auction || auction.status !== 'active') {
            return res.status(400).json({ error: 'المزاد غير نشط' });
        }
        
        const currentPrice = auction.currentPrice || auction.startPrice || 0;
        if (amount <= currentPrice) {
            return res.status(400).json({ error: `المزايدة يجب أن تكون أكثر من ${currentPrice}` });
        }

        // إضافة المزايدة
        const newBid = await createBid({
            auctionId: new mongoose.Types.ObjectId(auctionId),
            userId: new mongoose.Types.ObjectId(userId),
            userName,
            amount,
            timestamp: new Date()
        });

        // تحديث المزاد
        await updateAuction(auctionId, {
            currentPrice: amount,
            highestBidder: userName,
            highestBidderId: userId
        });

        broadcast({ type: 'BID_PLACED', auctionId, amount, bidder: userName });
        res.json({ success: true, bid: newBid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الحصول على مزايدات المزاد
app.get('/api/bids/:auctionId', async (req, res) => {
    try {
        const bids = await findAllBids({ auctionId: new mongoose.Types.ObjectId(req.params.auctionId) });
        res.json(bids);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الحصول على مزايدات المستخدم
app.get('/api/user-bids/:userId', async (req, res) => {
    try {
        const bids = await Bid.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.params.userId) } },
            { $lookup: { from: 'auctions', localField: 'auctionId', foreignField: '_id', as: 'auction' } },
            { $sort: { timestamp: -1 } },
            { $project: { 'auction.itemName': 1, amount: 1, timestamp: 1, auctionId: 1 } }
        ]);
        res.json(bids);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// تسجيل دخول الإدارة
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// الحصول على جميع المستخدمين
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await findAllUsers();
        // إزالة كلمات المرور
        const safeUsers = users.map(u => {
            const { password, ...userData } = u;
            return userData;
        });
        res.json(safeUsers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الموافقة على مستخدم
app.post('/api/admin/approve-user/:id', async (req, res) => {
    try {
        await updateUser(req.params.id, { status: 'approved' });
        broadcast({ type: 'USER_APPROVED', userId: req.params.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// إنشاء مزاد
app.post('/api/admin/create-auction', async (req, res) => {
    const { itemName, description, startPrice, date, mediaType, mediaUrl, mediaGallery, durationMinutes, bidIncrement, startTime } = req.body;
    try {
        const newAuction = await Auction.create({
            itemName,
            description,
            startPrice,
            currentPrice: startPrice,
            bidIncrement: bidIncrement || 100,
            currentBid: 0,
            status: 'pending',
            date,
            startTime: startTime || null,
            endTime: null,
            durationMinutes: durationMinutes || 60,
            mediaType,
            mediaUrl,
            mediaGallery: mediaGallery || [],
            sellerApproved: false,
            createdAt: new Date()
        });
        
        broadcast({ type: 'NEW_AUCTION', auctionId: newAuction._id });
        res.json({ id: newAuction._id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// بدء المزاد مع المؤقت
app.post('/api/admin/start-auction/:id', async (req, res) => {
    try {
        const auction = await findAuction({ _id: req.params.id });
        if (!auction) return res.status(404).json({ error: 'المزاد غير موجود' });
        
        const startTime = new Date();
        const durationMs = (auction.durationMinutes || 60) * 60 * 1000;
        const endTime = new Date(startTime.getTime() + durationMs);
        
        await updateAuction(req.params.id, { 
            status: 'active',
            startTime: startTime,
            endTime: endTime
        });
        
        startAuctionTimer(req.params.id, endTime);
        broadcast({ type: 'AUCTION_STARTED', auctionId: req.params.id, endTime });
        res.json({ success: true, endTime });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// تمديد الوقت
app.post('/api/admin/extend-auction/:id', async (req, res) => {
    try {
        const { extendMinutes } = req.body;
        const auction = await findAuction({ _id: req.params.id });
        if (!auction || !auction.endTime) return res.status(400).json({ error: 'المزاد غير نشط' });
        
        const newEndTime = new Date(auction.endTime.getTime() + (extendMinutes || 5) * 60 * 1000);
        
        await updateAuction(req.params.id, { endTime: newEndTime });
        startAuctionTimer(req.params.id, newEndTime);
        broadcast({ type: 'AUCTION_EXTENDED', auctionId: req.params.id, endTime: newEndTime });
        res.json({ success: true, endTime: newEndTime });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// إنهاء المزاد
app.post('/api/admin/end-auction/:id', async (req, res) => {
    try {
        await updateAuction(req.params.id, { status: 'ended' });
        broadcast({ type: 'AUCTION_ENDED', auctionId: req.params.id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الحصول على الإشعارات
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notifs = await findNotifications(req.params.userId);
        res.json(notifs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// وضع علامة على الإشعار كمقروء
app.post('/api/notifications/:userId/mark-read/:id', async (req, res) => {
    try {
        await Notification.updateOne({ _id: req.params.id }, { read: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// الإحصائيات
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await mongoose.model('User').countDocuments({ status: 'approved' });
        const totalAuctions = await Auction.countDocuments();
        const totalBids = await Bid.countDocuments();
        
        const auctionStats = await Auction.aggregate([
            { $match: { status: 'ended' } },
            { $group: { _id: null, totalRevenue: { $sum: '$currentPrice' } } }
        ]);
        
        const totalRevenue = auctionStats[0]?.totalRevenue || 0;

        res.json({
            totalUsers,
            totalAuctions,
            totalBids,
            totalRevenue
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ===== نظام الرسائل والدردشة =====

//发送 رسالة
app.post('/api/messages/send', async (req, res) => {
    const { senderId, senderName, receiverId, auctionId, content } = req.body;
    try {
        if (!senderId || !content) {
            return res.status(400).json({ error: 'المعرف والرسالة مطلوبة' });
        }
        
        const message = await Message.create({
            senderId: new mongoose.Types.ObjectId(senderId),
            senderName,
            receiverId: receiverId ? new mongoose.Types.ObjectId(receiverId) : null,
            auctionId: auctionId ? new mongoose.Types.ObjectId(auctionId) : null,
            content,
            type: 'text',
            createdAt: new Date()
        });
        
        broadcast({ type: 'NEW_MESSAGE', message });
        res.json({ success: true, message });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 获取 رسائل
app.get('/api/messages', async (req, res) => {
    const { userId, auctionId } = req.query;
    try {
        let query = {
            $or: [
                { senderId: new mongoose.Types.ObjectId(userId) },
                { receiverId: new mongoose.Types.ObjectId(userId) },
                { receiverId: null }
            ]
        };
        
        if (auctionId) {
            query.$and = [{ auctionId: new mongoose.Types.ObjectId(auctionId) }];
        }
        
        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();
        
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// marquer كمقروء
app.post('/api/messages/mark-read', async (req, res) => {
    const { messageIds } = req.body;
    try {
        await Message.updateMany(
            { _id: { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) } },
            { read: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ===== رفع الملفات =====

app.post('/api/upload', upload.array('files', 10), (req, res) => {
    try {
        const files = req.files.map(f => ({
            filename: f.filename,
            originalName: f.originalname,
            path: '/uploads/' + f.filename,
            size: f.size,
            type: f.mimetype
        }));
        res.json({ success: true, files });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use('/uploads', express.static(uploadsDir));

// إرسال إشعار جماعي
app.post('/api/broadcast', async (req, res) => {
    const { content } = req.body;
    try {
        const users = await User.find({ status: 'approved' });
        const notifications = users.map(u => ({
            userId: u._id,
            message: content,
            type: 'broadcast',
            read: false,
            createdAt: new Date()
        }));
        await Notification.insertMany(notifications);
        broadcast({ type: 'BROADCAST', content });
        res.json({ success: true, count: notifications.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// مسح جميع البيانات
app.post('/api/admin/clear-all', async (req, res) => {
    try {
        await Promise.all([
            User.deleteMany({}),
            Auction.deleteMany({}),
            Bid.deleteMany({}),
            Notification.deleteMany({}),
            Message.deleteMany({})
        ]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'الطلب غير موجود' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('خطأ:', err);
    res.status(err.status || 500).json({ error: err.message || 'خطأ الخادم' });
});

// بدء الخادم
initDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
        console.log(`✅ متاح على: http://localhost:${PORT}`);
        console.log(`🗄️ Database: MongoDB`);
        console.log(`📊 Admin Password: ${ADMIN_PASSWORD}`);
        console.log(`🌍 Environment: ${NODE_ENV}`);
    });
}).catch(e => {
    console.error('❌ Database error:', e.message);
    process.exit(1);
});

process.on('SIGINT', () => {
    clients.forEach(ws => ws.close());
    process.exit(0);
});
