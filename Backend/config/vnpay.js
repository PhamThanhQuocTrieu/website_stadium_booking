const { VNPay, ignoreLogger } = require('vnpay');

const paymentUrl = process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const parsedPaymentUrl = new URL(paymentUrl);

const vnpayConfig = {
  tmnCode: process.env.VNPAY_TMN_CODE,
  secureSecret: process.env.VNPAY_HASH_SECRET,
  vnpayHost: `${parsedPaymentUrl.protocol}//${parsedPaymentUrl.host}`,
  returnUrl: process.env.VNPAY_RETURN_URL,
  ipnUrl: process.env.VNPAY_IPN_URL,
  testMode: true,
  hashAlgorithm: 'SHA512',
  enableLog: false,
  loggerFn: ignoreLogger,
  endpoints: {
    paymentEndpoint: parsedPaymentUrl.pathname.replace(/^\//, ''),
    queryDrRefundEndpoint: 'merchant_webapi/api/transaction',
    getBankListEndpoint: 'qrpayauth/api/merchant/get_bank_list'
  }
};

const vnpay = new VNPay(vnpayConfig);

module.exports = { vnpay, vnpayConfig };
