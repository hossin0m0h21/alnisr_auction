import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://alnisr_auction:Hmh4242001@alnisrauction.l7jysft.mongodb.net/?appName=AlnisrAuction';

let db = null;

// ===== تعريف المخطط والنماذج =====
const userSchema = new mongoose.Schema({
    phone: { type: String, unique: true, required: true, index: true },
    fullname: { type: String, required: true },
    password: { type: String, required: true },
    status: { type: String, default: 'pending', index: true },
    createdAt: { type: Date, default: Date.now }
});

const auctionSchema = new mongoose.Schema({
    itemName: { type: String, required: true, index: true },
    description: String,
    startPrice: Number,
    currentPrice: Number,
    currentBid: Number,
    bidIncrement: { type: Number, default: 100 },
    status: { type: String, default: 'pending', index: true },
    highestBidder: String,
    highestBidderId: mongoose.Schema.Types.ObjectId,
    date: String,
    startTime: Date,
    endTime: Date,
    durationMinutes: { type: Number, default: 60 },
    extensionMinutes: { type: Number, default: 5 },
    lastBidTime: Date,
    mediaType: String,
    mediaUrl: String,
    mediaGallery: [String],
    sellerApproved: Boolean,
    winnerPhone: String,
    winnerName: String,
    winnerAmount: Number,
    createdAt: { type: Date, default: Date.now, index: true }
});

const bidSchema = new mongoose.Schema({
    auctionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userName: String,
    amount: Number,
    timestamp: { type: Date, default: Date.now, index: true }
});

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, index: true },
    message: String,
    type: { type: String, default: 'info' },
    read: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now }
});

const settingsSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String
});

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    senderName: String,
    receiverId: { type: mongoose.Schema.Types.ObjectId, index: true },
    auctionId: { type: mongoose.Schema.Types.ObjectId, index: true },
    content: { type: String, required: true },
    type: { type: String, default: 'text' },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const User = mongoose.model('User', userSchema);
const Auction = mongoose.model('Auction', auctionSchema);
const Bid = mongoose.model('Bid', bidSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Settings = mongoose.model('Settings', settingsSchema);

// ===== دوال قاعدة البيانات الأساسية =====
export async function initDB() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ متصل بـ MongoDB:', MONGO_URI);
        db = mongoose.connection;
        return db;
    } catch (error) {
        console.error('❌ فشل الاتصال بـ MongoDB:', error.message);
        throw error;
    }
}

// دالة مساعدة للبحث عن صيغة SQL البسيطة
function parseSimpleSQL(query, params) {
    // لا يتم استخدام هذه الدالة مباشرة - للتوافق فقط
    console.warn('⚠️ تم استدعاء SQL مباشر. تجنب استخدام SQL text في المشروع الجديد');
    return null;
}

// دوال العمليات الأساسية
export const dbGet = async (query, params = []) => {
    if (typeof query === 'string' && query.includes('SELECT')) {
        // استعلام SQL - تحويل تقريبي للعمليات الشائعة
        if (query.includes('FROM users WHERE phone')) {
            return await findUser({ phone: params[0] });
        }
        if (query.includes('FROM users WHERE') && query.includes('id = ?')) {
            return await findUser({ _id: params[0] });
        }
        if (query.includes('FROM auctions')) {
            return await findAuction({ _id: params[0] });
        }
        return null;
    }
    // للاستخدام الحديث مع MongoDB
    return await User.findOne(query).lean();
};

export const dbAll = async (query, params = []) => {
    if (typeof query === 'string' && query.includes('SELECT')) {
        // استعلام SQL - تحويل تقريبي
        if (query.includes('FROM users')) {
            return await findAllUsers();
        }
        if (query.includes('FROM auctions')) {
            return await findAllAuctions();
        }
        if (query.includes('FROM bids')) {
            return await findAllBids();
        }
        return [];
    }
    // للاستخدام الحديث
    return await User.find(query).sort({ createdAt: -1 }).lean();
};

export const dbRun = async (query, params = []) => {
    // للتوافق مع الكود القديم
    console.warn('⚠️ استخدام dbRun مع SQL text قديم. استخدم الدوال الحديثة بدلاً من ذلك');
    return { id: null, changes: 0 };
};

// ===== دوال متقدمة للعمليات المعقدة =====
export const findUser = (query) => User.findOne(query).lean();
export const findAuction = (query) => Auction.findOne(query).lean();
export const findAllUsers = (query = {}) => User.find(query).lean();
export const findAllAuctions = (query = {}) => Auction.find(query).sort({ createdAt: -1 }).lean();
export const findAllBids = (query = {}) => Bid.find(query).sort({ timestamp: -1 }).lean();
export const findNotifications = (userId) => Notification.find({ userId }).sort({ createdAt: -1 }).lean();

export const createUser = (data) => {
    const user = new User(data);
    return user.save();
};

export const createAuction = (data) => {
    const auction = new Auction(data);
    return auction.save();
};

export const createBid = (data) => {
    const bid = new Bid(data);
    return bid.save();
};

export const updateAuction = (id, data) => Auction.findByIdAndUpdate(id, data, { new: true });
export const updateUser = (id, data) => User.findByIdAndUpdate(id, data, { new: true });
export const updateBid = (id, data) => Bid.findByIdAndUpdate(id, data, { new: true });

export const findMessages = (query) => Message.find(query).sort({ createdAt: 1 }).lean();
export const createMessage = (data) => {
    const message = new Message(data);
    return message.save();
};
export const updateMessage = (id, data) => Message.findByIdAndUpdate(id, data, { new: true });

// ===== تصدير النماذج =====
export { User, Auction, Bid, Notification, Settings, Message };

export default { initDB, dbGet, dbAll, dbRun, User, Auction, Bid, Notification, Settings };
