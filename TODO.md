# TODO - تطوير موقع ALNISR

## المرحلة 1: إصلاح لوحة الإدارة (Admin)
- [x] إضافة endpoints ناقصة في `server.js` لإدارة الأعضاء:
  - [ ] DELETE /api/admin/users/:id
  - [ ] POST /api/admin/reject-user/:id (أو تحديث status)
- [ ] تعديل `server.js` لتوحيد التعامل مع صلاحيات Admin (minimal guard).
- [ ] تنظيف `script.js` من التكرارات:
  - [ ] دمج rejectUser/deleteUser في نسخة واحدة
  - [ ] تحويل رفض/حذف الأعضاء لاستخدام الـ API بدل IndexedDB
- [ ] تحديث `script.js` لتطابق بيانات التبويبات مع `admin.html`.
- [ ] تجربة يدوية على:
  - [ ] approve-user
  - [ ] reject/delete


## المرحلة 2: ميزات جديدة (بعد استقرار Admin)
- [ ] إضافة قسم Logs/Audit Log في `admin.html` + ربطه بـ `/api/admin/logs`
- [ ] إضافة تصفية/بحث للأعضاء حسب status
- [ ] تحسين عرض سجل المزادات (مع media gallery إن توفرت البيانات)

## المرحلة 3: اختبار وتشغيل
- [ ] npm start
- [ ] فحص بدون أخطاء في Console
- [ ] فحص API calls عبر Network

