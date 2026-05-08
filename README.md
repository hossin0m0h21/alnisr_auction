# 🐦 ALNISR Auction Platform - منصة المزاد الإلكترونية

منصة مزاد إلكترونية متكاملة للطيور والحيوانات الأليفة تدعم المزاد المباشر، الدفع الإلكتروني، والإشعارات الفورية.

## ✨ الميزات

### 🎯 للمستخدمين
- ✅ التسجيل والدخول مع التحقق عبر OTP
- ✅ المزايدة على المنتجات في الوقت الفعلي
- ✅ متابعة المزايدات والفوز
- ✅ دفع آمن (Stripe, PayPal, Apple Pay, Google Pay)
- ✅ الإشعارات الفورية عبر البريد والـ SMS
- ✅ نظام التقييمات
- ✅ الدردشة والرسائل
- ✅ سجل المشتريات والفوز

### 🔧 للإدارة
- 👨‍💼 لوحة تحكم متقدمة
- 📋 إدارة المزادات (إنشاء، تعديل، حذف)
- 👥 إدارة المستخدمين والموافقة
- 💳 إدارة المدفوعات والفواتير
- 🏆 تحديد الفائزين تلقائياً
- 📊 تقارير والإحصائيات
- 🔔 إرسال إشعارات جماعية
- 📝 سجل العمليات والتدقيق

## 🚀 البدء السريع

### المتطلبات
- Node.js 14+
- MongoDB
- npm أو yarn

### التثبيت

1. **استنساخ المشروع**
```bash
git clone https://github.com/yourusername/alnisr-auction.git
cd alnisr-auction
```

2. **تثبيت المكتبات**
```bash
npm install
```

3. **إعداد المتغيرات البيئية**
```bash
cp .env.example .env
```

ثم عدّل ملف `.env` بـ:
```
MONGO_URI=your_mongodb_connection_string
STRIPE_SECRET_KEY=your_stripe_key
TWILIO_ACCOUNT_SID=your_twilio_sid
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

4. **تشغيل الخادم**
```bash
npm start
```

الخادم سيعمل على `http://localhost:3000`

## 📱 URLs المهمة

- **الرئيسية**: http://localhost:3000
- **المزاد المباشر**: http://localhost:3000/auction.html
- **لوحة الإدارة**: http://localhost:3000/admin-dashboard.html
- **تسجيل الدخول**: http://localhost:3000/login.html

## 🔌 API Endpoints

### المصادقة
- `POST /api/otp/request` - طلب رمز OTP
- `POST /api/otp/verify` - التحقق من OTP
- `POST /api/register` - تسجيل جديد
- `POST /api/login` - دخول

### المزادات
- `GET /api/auctions` - الحصول على المزادات
- `GET /api/auctions/:id` - مزاد معين
- `POST /api/bid` - المزايدة

### المدفوعات
- `POST /api/payments/create` - إنشاء دفعة
- `GET /api/payments/:winnerCode` - حالة الدفعة
- `POST /api/payments/:winnerCode/confirm` - تأكيد الدفع

### الفائزون
- `POST /api/admin/finalize-auction/:id` - تحديد الفائز
- `GET /api/winner/:winnerCode` - بيانات الفائز

### الإدارة
- `GET /api/admin/users` - قائمة المستخدمين
- `POST /api/admin/approve-user/:id` - الموافقة على مستخدم
- `POST /api/admin/create-auction` - إنشاء مزاد
- `POST /api/admin/start-auction/:id` - بدء مزاد
- `POST /api/admin/end-auction/:id` - إنهاء مزاد

## 💳 تكامل الدفع

### Stripe
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// سيتم تنفيذه في payment.js
```

### Twilio (SMS)
```javascript
const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
```

### البريد الإلكتروني
```javascript
const nodemailer = require('nodemailer');
// سيتم إرسال الإشعارات عبر Gmail/SendGrid
```

## 📊 البنية

```
alnisr-auction/
├── server.js              # الخادم الرئيسي
├── database.js            # قاعدة البيانات والنماذج
├── services.js            # الخدمات المساعدة
├── api.js                 # دوال الـ API
├── package.json           # المكتبات
├── .env                   # المتغيرات البيئية
├── Dockerfile             # حاوية Docker
├── docker-compose.yml     # تكوين Docker
├── index.html             # الصفحة الرئيسية
├── auction.html           # صفحة المزاد المباشر
├── login.html             # صفحة الدخول
├── admin-dashboard.html   # لوحة الإدارة
├── styles.css             # الأنماط
├── script.js              # سكريبت الصفحات
└── uploads/               # الملفات المرفوعة
```

## 🐳 Docker

### البناء
```bash
docker build -t alnisr-auction .
```

### التشغيل
```bash
docker run -p 3000:3000 --env-file .env alnisr-auction
```

### مع Docker Compose
```bash
docker-compose up -d
```

## 🌐 النشر

### على Render.com

1. ربط المستودع على GitHub
2. إنشاء خدمة جديدة على Render
3. تعيين متغيرات البيئة
4. نشر تلقائي عند كل push

### على Heroku

```bash
heroku create your-app-name
heroku config:set MONGO_URI=your_uri
git push heroku main
```

### على Railway.app

1. ربط المستودع
2. تعيين متغيرات البيئة
3. نشر تلقائي

## 🔐 الأمان

- ✅ تشفير كلمات المرور مع bcryptjs
- ✅ معدل التحديد (Rate Limiting)
- ✅ CORS محدود
- ✅ Helmet للأمان
- ✅ المصادقة عبر JWT (اختياري)
- ✅ تحقق OTP قبل التسجيل
- ✅ تسجيل جميع العمليات (Audit Logs)

## 📞 الدعم

### خدمات مدمجة
- **البريد الإلكتروني**: Gmail, SendGrid
- **الرسائل النصية**: Twilio
- **الدفع**: Stripe, PayPal
- **قاعدة البيانات**: MongoDB

## 📄 الترخيص

MIT License - انظر LICENSE.md

## 👨‍💻 المساهمة

1. Fork المشروع
2. أنشئ فرع جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add some amazing feature'`)
4. Push للفرع (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## 📧 التواصل

البريد: info@alnisr-auction.com
الهاتف: +966XX XXX XXXX

---

## ✅ قائمة التحقق

### قبل النشر
- [ ] جميع المتغيرات البيئية معينة
- [ ] قاعدة البيانات متصلة
- [ ] الدفع مختبر وجاهز
- [ ] الإشعارات تعمل
- [ ] WebSockets جاهز
- [ ] الصور والملفات تُرفع بنجاح

### قبل الإنتاج
- [ ] اختبار شامل على الموبايل
- [ ] اختبار الأداء والحمل
- [ ] نسخ احتياطية آمنة
- [ ] سجلات وتتبع الأخطاء
- [ ] SSL/HTTPS فعّال
- [ ] CDN لتوزيع المحتوى

---

**تم تطوير هذا المشروع بـ ❤️ لمنصة مزاد احترافية وآمنة**
