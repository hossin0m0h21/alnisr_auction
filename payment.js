// 💳 نظام المدفوعات المتكامل
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { Payment } from './database.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key');

// ===== معالجة Stripe Payments =====
export async function createStripePaymentIntent(amount, currency = 'sar', metadata = {}) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // تحويل للفلس
            currency: currency.toLowerCase(),
            metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };
    } catch (error) {
        console.error('❌ خطأ Stripe:', error.message);
        return { success: false, error: error.message };
    }
}

export async function confirmStripePayment(paymentIntentId) {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded') {
            return { success: true, verified: true, status: 'completed' };
        } else if (paymentIntent.status === 'processing') {
            return { success: true, verified: false, status: 'processing' };
        } else if (paymentIntent.status === 'requires_action') {
            return { success: false, verified: false, status: 'requires_action' };
        } else {
            return { success: false, verified: false, status: paymentIntent.status };
        }
    } catch (error) {
        console.error('❌ خطأ في التحقق:', error.message);
        return { success: false, error: error.message };
    }
}

export async function refundStripePayment(paymentIntentId, amount = null) {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount ? Math.round(amount * 100) : undefined
        });

        return { success: true, refundId: refund.id };
    } catch (error) {
        console.error('❌ خطأ في استرجاع المبلغ:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== معالجة Apple Pay و Google Pay =====
export async function createApplePayPaymentRequest(amount, label = 'ALNISR Auction') {
    return {
        total: {
            label: label,
            amount: (amount).toString(),
            type: 'final'
        },
        supportedNetworks: ['visa', 'mastercard', 'amex'],
        supportedCountries: ['SA', 'AE', 'KW'],
        requiredBillingContactFields: ['postalAddress'],
        requiredShippingContactFields: ['email', 'phone']
    };
}

// ===== معالجة PayPal =====
export async function createPayPalOrder(amount, auctionId, winnerCode) {
    try {
        // هذا يتطلب PayPal SDK أو API
        // سيتم إضافته في الإصدار القادم
        return {
            success: true,
            orderId: 'PAYPAL_ORDER_' + Date.now(),
            approvalUrl: 'https://sandbox.paypal.com/...'
        };
    } catch (error) {
        console.error('❌ خطأ PayPal:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== معالجة التحويل البنكي =====
export function generateBankTransferDetails(amount, winnerCode) {
    return {
        accountName: 'ALNISR Auction',
        bankName: 'البنك الأهلي السعودي',
        iban: 'SA12 3456 7890 1234 5678 9012',
        amount: amount,
        reference: winnerCode,
        validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };
}

// ===== Webhook Handlers =====
export async function handleStripeWebhook(event) {
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                console.log('✅ دفعة نجحت:', event.data.object.id);
                return { success: true, action: 'payment_succeeded' };

            case 'payment_intent.payment_failed':
                console.log('❌ فشل الدفع:', event.data.object.id);
                return { success: false, action: 'payment_failed' };

            case 'charge.refunded':
                console.log('💰 تم استرجاع مبلغ:', event.data.object.id);
                return { success: true, action: 'refund_processed' };

            default:
                console.log('⚠️ حدث غير معروف:', event.type);
                return { success: false, action: 'unknown_event' };
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة Webhook:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== التقارير المالية =====
export async function generatePaymentReport(startDate, endDate) {
    try {
        const payments = await Payment.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
        }).lean();

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalTransactions = payments.length;
        const averageTransaction = totalRevenue / totalTransactions || 0;

        return {
            period: { start: startDate, end: endDate },
            totalRevenue,
            totalTransactions,
            averageTransaction,
            transactions: payments,
            breakdown: {
                byMethod: groupByPaymentMethod(payments),
                byStatus: groupByStatus(payments)
            }
        };
    } catch (error) {
        console.error('❌ خطأ في التقرير:', error.message);
        return { success: false, error: error.message };
    }
}

function groupByPaymentMethod(payments) {
    const grouped = {};
    payments.forEach(p => {
        grouped[p.paymentMethod] = (grouped[p.paymentMethod] || 0) + p.amount;
    });
    return grouped;
}

function groupByStatus(payments) {
    const grouped = {};
    payments.forEach(p => {
        grouped[p.status] = (grouped[p.status] || 0) + 1;
    });
    return grouped;
}

export default {
    createStripePaymentIntent,
    confirmStripePayment,
    refundStripePayment,
    createApplePayPaymentRequest,
    createPayPalOrder,
    generateBankTransferDetails,
    handleStripeWebhook,
    generatePaymentReport
};
