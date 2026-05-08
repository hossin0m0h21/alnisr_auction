#!/usr/bin/env node

/**
 * 🚀 ALNISR Auction - دليل البدء السريع
 * 
 * هذا الملف يحتوي على أوامر سريعة للبدء مع المشروع
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔════════════════════════════════════════╗
║     🐦 ALNISR Auction Platform        ║
║      دليل البدء السريع                ║
╚════════════════════════════════════════╝
`);

const commands = {
  setup: {
    title: '⚙️ إعداد المشروع',
    steps: [
      'npm install',
      'cp .env.example .env (أو استخدم الـ .env الموجود)',
      'mkdir -p uploads',
      'npm start'
    ]
  },
  development: {
    title: '🛠️ وضع التطوير',
    steps: [
      'npm run dev',
      'الفتح: http://localhost:3000',
      'لوحة الإدارة: http://localhost:3000/admin-dashboard.html'
    ]
  },
  production: {
    title: '🚀 النشر للإنتاج',
    steps: [
      'تحديث .env بـ production values',
      'docker build -t alnisr-auction .',
      'docker run -p 3000:3000 --env-file .env alnisr-auction'
    ]
  },
  testing: {
    title: '✅ الاختبار',
    steps: [
      'اختبر OTP: POST /api/otp/request',
      'اختبر الدفع: POST /api/payments/stripe/create-intent',
      'اختبر الفائز: POST /api/admin/finalize-auction/:id',
      'تحقق من المزادات: GET /api/auctions'
    ]
  },
  monitoring: {
    title: '📊 المراقبة',
    steps: [
      'السجلات: pm2 logs alnisr-auction',
      'حالة النظام: pm2 status',
      'إعادة تشغيل: pm2 restart alnisr-auction'
    ]
  }
};

console.log('📚 اختر من القائمة:\n');
Object.keys(commands).forEach((key, index) => {
  console.log(`${index + 1}. ${commands[key].title}`);
});
console.log(`${Object.keys(commands).length + 1}. عرض المزيد من المعلومات\n`);

// عرض جميع الأوامر
Object.values(commands).forEach(section => {
  console.log(`\n${section.title}`);
  console.log('─'.repeat(40));
  section.steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
});

console.log(`
╔════════════════════════════════════════╗
║         📖 الملفات المهمة             ║
╚════════════════════════════════════════╝

📋 server.js              - الخادم الرئيسي
📊 database.js            - قاعدة البيانات والنماذج
📧 services.js            - خدمات البريد والإشعارات
💳 payment.js             - معالج الدفع
🔧 api.js                 - دوال الـ API
🎨 admin-dashboard.html   - لوحة الإدارة
📝 .env                   - المتغيرات البيئية
🐳 Dockerfile             - حاوية Docker

╔════════════════════════════════════════╗
║         🔗 الروابط المهمة             ║
╚════════════════════════════════════════╝

🏠 الرئيسية              http://localhost:3000
🎯 المزاد المباشر         http://localhost:3000/auction.html
📝 تسجيل الدخول           http://localhost:3000/login.html
👤 الملف الشخصي           http://localhost:3000/profile.html
🔐 لوحة الإدارة           http://localhost:3000/admin-dashboard.html

╔════════════════════════════════════════╗
║         🔑 المتغيرات الأساسية        ║
╚════════════════════════════════════════╝

NODE_ENV                development/production
PORT                    3000
MONGO_URI               your_mongodb_connection_string
STRIPE_SECRET_KEY       sk_live_your_key
TWILIO_ACCOUNT_SID      your_twilio_sid
EMAIL_USER              your_email@gmail.com
ADMIN_PASSWORD          admin2026

╔════════════════════════════════════════╗
║         ⚡ أوامر سريعة               ║
╚════════════════════════════════════════╝

npm install              - تثبيت المكتبات
npm start               - بدء الخادم
npm run dev             - وضع التطوير
docker-compose up       - تشغيل عبر Docker
pm2 start server.js     - تشغيل مع PM2
pm2 logs               - عرض السجلات

╔════════════════════════════════════════╗
║         📞 في حالة المشاكل            ║
╚════════════════════════════════════════╝

1. تحقق من الـ MongoDB متصل:
   mongo "your_connection_string"

2. تحقق من Stripe API Key:
   echo $STRIPE_SECRET_KEY

3. تحقق من البريد يعمل:
   POST /api/otp/request {"phone": "+966..."}

4. عرض السجلات:
   pm2 logs
   tail -f logs/error.log

5. إعادة تشغيل الخادم:
   pm2 restart alnisr-auction

╔════════════════════════════════════════╗
║         ✨ الميزات الرئيسية          ║
╚════════════════════════════════════════╝

✅ نظام OTP للتحقق
✅ مزاد فعلي مباشر
✅ دفع آمن (Stripe, PayPal, etc)
✅ نظام الفائزين التلقائي
✅ إشعارات فورية (Email + SMS)
✅ لوحة إدارة احترافية
✅ تقييمات وآراء
✅ سجلات كاملة
✅ تقارير مالية
✅ WebSockets للتحديث الفوري

╔════════════════════════════════════════╗
║         🎉 هل تحتاج إلى مساعدة؟      ║
╚════════════════════════════════════════╝

📖 اقرأ: README.md
🚀 للنشر: اقرأ DEPLOYMENT.md
✨ للميزات: اقرأ FEATURES.md
✅ المكتمل: اقرأ COMPLETION.md

البريد: info@alnisr-auction.com
الهاتف: +966XX XXX XXXX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

تم الإعداد بنجاح! 🎊
ابدأ مع: npm start

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
