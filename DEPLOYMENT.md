# 🚀 نشر ALNISR على الخوادم المختلفة

## 1️⃣ نشر على Render.com (الأفضل والأسهل)

### الخطوة 1: ربط GitHub
1. أنشئ حساب على [Render.com](https://render.com)
2. اضغط على "New +" ثم "Web Service"
3. اختر "Deploy existing repository"
4. ربط حساب GitHub الخاص بك

### الخطوة 2: إعدادات الخدمة
```
Build Command: npm install
Start Command: npm start
Environment: Node
```

### الخطوة 3: متغيرات البيئة
أضف في قسم "Environment":
```
NODE_ENV=production
PORT=3000
MONGO_URI=your_mongodb_uri
ADMIN_PASSWORD=your_secure_password
STRIPE_SECRET_KEY=sk_live_...
TWILIO_ACCOUNT_SID=...
EMAIL_USER=...
EMAIL_PASSWORD=...
```

### الخطوة 4: النشر
- سيتم النشر التلقائي عند كل `git push` للـ main

---

## 2️⃣ نشر على Railway.app

### الخطوة 1: الإعداد
1. أنشئ حساب على [Railway.app](https://railway.app)
2. ربط GitHub

### الخطوة 2: إنشاء المشروع
```bash
npm install -g railway
railway link
railway up
```

### الخطوة 3: متغيرات البيئة
```bash
railway variables add MONGO_URI "your_uri"
railway variables add STRIPE_SECRET_KEY "sk_live_..."
```

---

## 3️⃣ نشر على Vercel (للـ Frontend فقط)

### الخطوة 1: إنشاء ملف vercel.json
```json
{
  "buildCommand": "echo 'Static build'",
  "outputDirectory": ".",
  "framework": "other",
  "serverless": false
}
```

### الخطوة 2: النشر
```bash
npm install -g vercel
vercel
```

---

## 4️⃣ نشر على Heroku (لا ينصح به حالياً)

```bash
# تثبيت Heroku CLI
npm install -g heroku

# تسجيل الدخول
heroku login

# إنشاء التطبيق
heroku create your-app-name

# متغيرات البيئة
heroku config:set MONGO_URI="your_uri"
heroku config:set STRIPE_SECRET_KEY="sk_live_..."

# النشر
git push heroku main

# عرض السجلات
heroku logs --tail
```

---

## 5️⃣ نشر محلي مع Docker

### الخطوة 1: البناء
```bash
docker build -t alnisr-auction .
```

### الخطوة 2: التشغيل
```bash
docker run -p 3000:3000 \
  -e MONGO_URI="your_uri" \
  -e STRIPE_SECRET_KEY="sk_live_..." \
  alnisr-auction
```

### استخدام Docker Compose
```bash
docker-compose up -d
```

---

## 6️⃣ نشر على AWS EC2

### الخطوة 1: إنشاء Instance
1. Launch EC2 instance (Ubuntu 20.04)
2. اختر t3.micro (مجاني)

### الخطوة 2: الاتصال والإعداد
```bash
ssh -i your-key.pem ubuntu@your-instance-ip

# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت MongoDB (اختياري - استخدم Atlas بدلاً منه)
sudo apt install -y mongodb

# استنساخ المشروع
git clone https://github.com/yourrepo/alnisr-auction.git
cd alnisr-auction

# تثبيت المكتبات
npm install

# إنشاء .env
nano .env
# أضف المتغيرات المطلوبة

# تثبيت PM2 لـ production
sudo npm install -g pm2
pm2 start server.js --name "alnisr-auction"
pm2 save
pm2 startup

# إعداد Nginx (reverse proxy)
sudo apt install -y nginx
```

### إعدادات Nginx
```bash
sudo nano /etc/nginx/sites-available/default
```

أضف:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

ثم:
```bash
sudo systemctl restart nginx

# إعداد SSL مع Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 7️⃣ نشر على DigitalOcean

### عبر Marketplace
1. ابحث عن "Node.js" في Marketplace
2. اختر الخطة
3. اتبع التعليمات

### يدويا
```bash
# SSH للـ Droplet
ssh root@your-droplet-ip

# اتبع نفس خطوات AWS أعلاه
```

---

## 8️⃣ نشر على Google Cloud Run

```bash
# تثبيت Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# بناء الحاوية
gcloud builds submit --tag gcr.io/your-project/alnisr-auction

# النشر
gcloud run deploy alnisr-auction \
  --image gcr.io/your-project/alnisr-auction \
  --platform managed \
  --region us-central1 \
  --set-env-vars MONGO_URI="your_uri"
```

---

## ✅ قائمة التحقق قبل النشر

- [ ] **MongoDB**: خادم جاهز وآمن
- [ ] **Stripe**: مفاتيح API جاهزة
- [ ] **البريد الإلكتروني**: Gmail/SendGrid معداً
- [ ] **الـ SMS**: Twilio معداً (اختياري)
- [ ] **المتغيرات البيئية**: كلها معينة وآمنة
- [ ] **SSL/HTTPS**: مفعل
- [ ] **اختبار شامل**: قبل النشر
- [ ] **النسخ الاحتياطية**: محفوظة
- [ ] **المراقبة**: مفعلة (Sentry, DataDog)
- [ ] **السجلات**: محفوظة بشكل آمن

---

## 🔍 المراقبة والسجلات

### Sentry للأخطاء
```javascript
import Sentry from "@sentry/node";
Sentry.init({ dsn: "your-sentry-dsn" });
```

### DataDog للأداء
```bash
npm install datadog-browser-rum
```

### Logs
```bash
# عرض السجلات على Render
render logs

# عرض السجلات على Railway
railway logs

# عرض السجلات على EC2
pm2 logs alnisr-auction
```

---

## 🔒 الأمان

### في الإنتاج
1. ✅ استخدم HTTPS فقط
2. ✅ قيّد CORS للدومينات الموثوقة فقط
3. ✅ استخدم متغيرات البيئة للأسرار
4. ✅ فعّل Rate Limiting
5. ✅ استخدم Helmet للأمان
6. ✅ قم بتحديث جميع المكتبات
7. ✅ استخدم شهادات SSL/TLS
8. ✅ فعّل 2FA للإدارة
9. ✅ قم بعمل نسخ احتياطية منتظمة
10. ✅ راقب الأنشطة المريبة

---

## 🆘 استكشاف الأخطاء

### المشكلة: خطأ الاتصال بـ MongoDB
```
Error: connect ECONNREFUSED
```
**الحل**: تحقق من:
- رابط MongoDB صحيح
- VPN/IP موثوق من MongoDB Atlas
- الخادم يعمل

### المشكلة: خطأ الدفع
```
Error: Stripe API key invalid
```
**الحل**: تحقق من:
- المفتاح صحيح (sk_live_ أو sk_test_)
- ليس في Git
- الموقع في .env

### المشكلة: أداء بطيء
**الحل**:
- استخدم CDN للملفات الثابتة
- فعّل Redis للتخزين المؤقت
- قلل حجم الرسائل
- استخدم Compression Middleware

---

**تم توثيق النشر بنجاح! 🎉**
