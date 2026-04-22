// تعديل api.js - غير رابط الـ Backend حسب استضافتك

// للاستضافة على GitHub Pages + Render/Railway/Heroku:
// 1. استضف Frontend على GitHub Pages
// 2. استضف Backend على Render/Railway
// 3. غير السطر التالي برابط Backend الفعلي:

// مثال Render:
const BACKEND_URL = 'https://your-app.onrender.com';

// مثال Railway:
// const BACKEND_URL = 'https://your-app.up.railway.app';

// مثال Heroku:
// const BACKEND_URL = 'https://your-app.herokuapp.com';

// ثم استخدم في api.js:
// const API_URL = `${BACKEND_URL}/api`;
// const WS_URL = `wss://${new URL(BACKEND_URL).hostname}`;
