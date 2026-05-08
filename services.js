// 📧 خدمات البريد الإلكتروني والإشعارات
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// ===== إعداد البريد الإلكتروني =====
const emailTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// ===== إعداد Twilio للـ SMS =====
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ===== دوال البريد الإلكتروني =====
export async function sendEmailOTP(email, otp, fullname = 'المستخدم') {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                    .container { max-width: 500px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #d4a574; }
                    .otp-code { background: #f9f9f9; border: 2px solid #d4a574; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 3px; margin: 20px 0; color: #333; }
                    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🐦 ALNISR AUCTION</div>
                        <p>منصة المزاد الإلكترونية</p>
                    </div>
                    <h2>مرحباً ${fullname}</h2>
                    <p>تم طلب رمز التحقق الخاص بك. استخدم الرمز التالي للتحقق من هويتك:</p>
                    <div class="otp-code">${otp}</div>
                    <p style="color: #999; font-size: 12px;">ينتهي هذا الرمز بعد 10 دقائق</p>
                    <p>إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد.</p>
                    <div class="footer">
                        <p>&copy; 2026 ALNISR Auction. جميع الحقوق محفوظة.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'ALNISR Auction',
            to: email,
            subject: `رمز التحقق من ALNISR: ${otp}`,
            html: htmlContent
        });

        return { success: true, message: 'تم إرسال الرمز بنجاح' };
    } catch (error) {
        console.error('❌ خطأ في إرسال البريد:', error);
        return { success: false, error: error.message };
    }
}

export async function sendAuctionWinnerEmail(email, fullname, auctionName, amount, winnerCode) {
    try {
        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px; }
                    .logo { font-size: 24px; font-weight: bold; color: #d4a574; }
                    .success-badge { display: inline-block; background: #4caf50; color: white; padding: 10px 20px; border-radius: 20px; margin: 10px 0; }
                    .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .label { font-weight: bold; color: #666; }
                    .value { color: #333; }
                    .payment-button { display: block; width: 100%; background: #d4a574; color: white; padding: 12px; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🏆 ALNISR AUCTION</div>
                        <div class="success-badge">مبروك! أنت الفائز</div>
                    </div>
                    <h2>مرحباً ${fullname}</h2>
                    <p>نهنئك بفوزك في المزاد! إليك تفاصيل الفوز:</p>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="label">المنتج:</span>
                            <span class="value">${auctionName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">المبلغ النهائي:</span>
                            <span class="value" style="color: #d4a574; font-weight: bold;">${amount} ر.س</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">رمز الفوز:</span>
                            <span class="value">${winnerCode}</span>
                        </div>
                    </div>
                    
                    <p>يرجى إكمال الدفع خلال 48 ساعة لتأكيد فوزك:</p>
                    <a href="${process.env.BACKEND_URL}/payment/${winnerCode}" class="payment-button">إجراء الدفع الآن</a>
                    
                    <p style="color: #999; font-size: 12px; margin-top: 20px;">يرجى عدم تأخير الدفع لتجنب إلغاء الفوز</p>
                </div>
            </body>
            </html>
        `;

        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'ALNISR Auction',
            to: email,
            subject: `🏆 مبروك! أنت الفائز في مزاد ${auctionName}`,
            html: htmlContent
        });

        return { success: true };
    } catch (error) {
        console.error('❌ خطأ في إرسال بريد الفائز:', error);
        return { success: false, error: error.message };
    }
}

export async function sendBidConfirmationEmail(email, fullname, auctionName, bidAmount) {
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'ALNISR Auction',
            to: email,
            subject: `✓ تم تأكيد المزايدة: ${auctionName}`,
            html: `
                <h2>مرحباً ${fullname}</h2>
                <p>تم تسجيل مزايدتك بنجاح في مزاد <strong>${auctionName}</strong></p>
                <p>المبلغ المزايد: <strong>${bidAmount} ر.س</strong></p>
                <p>سيتم إخطارك عند تجاوز مزايدتك.</p>
            `
        });
        return { success: true };
    } catch (error) {
        console.error('❌ خطأ:', error);
        return { success: false };
    }
}

export async function sendPaymentConfirmationEmail(email, fullname, orderId, amount, paymentMethod) {
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'ALNISR Auction',
            to: email,
            subject: `✓ تم تأكيد الدفع: رقم الطلب ${orderId}`,
            html: `
                <h2>شكراً ${fullname}</h2>
                <p>تم استقبال دفعتك بنجاح!</p>
                <p>رقم الطلب: ${orderId}</p>
                <p>المبلغ: ${amount} ر.س</p>
                <p>طريقة الدفع: ${paymentMethod}</p>
                <p>سيتم معالجة طلبك في أقرب وقت.</p>
            `
        });
        return { success: true };
    } catch (error) {
        console.error('❌ خطأ:', error);
        return { success: false };
    }
}

// ===== دوال الـ SMS =====
export async function sendSMSOTP(phoneNumber, otp) {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID) {
            console.warn('⚠️ Twilio لم يتم تكوينه');
            return { success: true, message: 'SMS في وضع التطوير' };
        }

        await twilioClient.messages.create({
            body: `رمز التحقق من ALNISR: ${otp}\nينتهي بعد 10 دقائق`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });

        return { success: true, message: 'تم إرسال الرمز بنجاح' };
    } catch (error) {
        console.error('❌ خطأ في إرسال SMS:', error);
        return { success: false, error: error.message };
    }
}

// ===== منشئ الأرقام العشوائية =====
export function generateOTP(length = 6) {
    return Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, '0');
}

export function generateWinnerCode() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `WIN-${timestamp}-${random}`;
}

// ===== دالة التحقق من الدفع (Stripe) =====
export async function verifyPayment(paymentId) {
    try {
        // هذا سيتم تنفيذه باستخدام Stripe API
        // سيتم إضافته لاحقاً
        return { success: true, verified: true };
    } catch (error) {
        console.error('❌ خطأ في التحقق من الدفع:', error);
        return { success: false };
    }
}

export default {
    sendEmailOTP,
    sendAuctionWinnerEmail,
    sendBidConfirmationEmail,
    sendPaymentConfirmationEmail,
    sendSMSOTP,
    generateOTP,
    generateWinnerCode,
    verifyPayment
};
