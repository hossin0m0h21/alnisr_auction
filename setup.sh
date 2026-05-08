#!/bin/bash

# 🚀 ALNISR Auction Platform - Setup Script

echo "🐦 ALNISR Auction Platform - سكريبت الإعداد"
echo "================================================"

# تحقق من Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت. الرجاء تثبيته من https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"

# تثبيت المكتبات
echo ""
echo "📦 تثبيت المكتبات..."
npm install

# إنشاء ملف .env إذا لم يكن موجوداً
if [ ! -f .env ]; then
    echo ""
    echo "📝 إنشاء ملف .env..."
    cp .env.example .env || cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb+srv://alnisr_auction:Hmh4242001@alnisrauction.l7jysft.mongodb.net/?appName=AlnisrAuction
ADMIN_PASSWORD=admin2026
JWT_SECRET=alnisr_jwt_secret_2026
CORS_ORIGIN=*
EMAIL_SERVICE=gmail
TWILIO_ACCOUNT_SID=
STRIPE_SECRET_KEY=
EOF
    echo "✅ تم إنشاء .env - الرجاء تحديث البيانات الحساسة"
fi

# إنشاء مجلد uploads
mkdir -p uploads

echo ""
echo "✅ تم إكمال الإعداد!"
echo ""
echo "🚀 لتشغيل الخادم:"
echo "   npm start"
echo ""
echo "📱 روابط مهمة:"
echo "   الرئيسية: http://localhost:3000"
echo "   المزاد: http://localhost:3000/auction.html"
echo "   الإدارة: http://localhost:3000/admin-dashboard.html"
echo ""
