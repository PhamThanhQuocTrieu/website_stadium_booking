const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { vnpay, vnpayConfig } = require('../config/vnpay');

const paidStatuses = ['PAID', 'Paid'];
const cancelledStatuses = ['CANCELLED', 'Cancelled'];
const pendingPaymentStatuses = ['UNPAID', 'PENDING', 'Pending', 'FAILED'];

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
};

const normalizeAmount = (amount) => Math.round(Number(amount || 0));

const createTxnRef = (bookingId) => {
  return `AH${Date.now()}${String(bookingId).slice(-6)}`;
};

const attachPaymentToBooking = async (booking) => {
  const payment = await Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
  const bookingData = booking.toObject ? booking.toObject() : booking;
  return { ...bookingData, payment };
};

const applySuccessPayment = async (payment, query) => {
  if (payment.status !== 'SUCCESS') {
    payment.status = 'SUCCESS';
    payment.transactionNo = query.vnp_TransactionNo;
    payment.bankCode = query.vnp_BankCode;
    payment.responseCode = query.vnp_ResponseCode;
    payment.transactionStatus = query.vnp_TransactionStatus;
    payment.paidAt = new Date();
    await payment.save();
  }

  const booking = await Booking.findById(payment.bookingId);
  if (booking) {
    booking.paymentStatus = 'PAID';
    booking.paymentMethod = 'VNPAY';
    booking.status = 'CONFIRMED';
    booking.transactionId = query.vnp_TransactionNo;
    booking.txnRef = query.vnp_TxnRef;
    booking.holdExpiresAt = undefined;
    await booking.save();
  }

  return booking;
};

exports.createVnpayPayment = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Booking khong hop le.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Khong tim thay booking.' });
    if (String(booking.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen thanh toan booking nay.' });
    }
    if (cancelledStatuses.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking da bi huy.' });
    }
    if (pendingPaymentStatuses.includes(booking.paymentStatus) && booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
      booking.status = 'Cancelled';
      booking.paymentStatus = 'FAILED';
      await booking.save();
      return res.status(400).json({ success: false, message: 'Thoi gian giu cho 5 phut da het. Vui long dat lai.' });
    }
    if (paidStatuses.includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Booking da duoc thanh toan.' });
    }
    if (!pendingPaymentStatuses.includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Booking khong o trang thai can thanh toan.' });
    }

    const bookingAmount = normalizeAmount(booking.totalPrice);
    if (amount !== undefined && normalizeAmount(amount) !== bookingAmount) {
      return res.status(400).json({ success: false, message: 'So tien thanh toan khong khop voi booking.' });
    }

    const existingPending = await Payment.findOne({
      bookingId: booking._id,
      method: 'VNPAY',
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    const payment = existingPending || await Payment.create({
      bookingId: booking._id,
      userId: req.user.id,
      amount: bookingAmount,
      method: 'VNPAY',
      provider: 'VNPAY',
      orderInfo: `Thanh toan booking ${booking._id}`,
      txnRef: createTxnRef(booking._id)
    });

    booking.paymentStatus = 'PENDING';
    booking.paymentMethod = 'VNPAY';
    booking.status = 'PENDING_PAYMENT';
    await booking.save();

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: payment.amount,
      vnp_IpAddr: getClientIp(req),
      vnp_ReturnUrl: vnpayConfig.returnUrl,
      vnp_TxnRef: payment.txnRef,
      vnp_OrderInfo: payment.orderInfo || `Thanh toan booking ${booking._id}`
    });

    return res.json({ success: true, paymentUrl });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleVnpayReturn = async (req, res) => {
  try {
    const verified = vnpay.verifyReturnUrl(req.query);
    if (!verified.isVerified) {
      return res.status(400).json({ success: false, message: 'Sai checksum VNPAY.' });
    }

    const payment = await Payment.findOne({ txnRef: req.query.vnp_TxnRef });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Khong tim thay giao dich.' });
    }

    let booking = await Booking.findById(payment.bookingId).populate('field user');
    const isSuccess = req.query.vnp_ResponseCode === '00' && req.query.vnp_TransactionStatus === '00';

    if (isSuccess) {
      booking = await applySuccessPayment(payment, req.query);
      booking = await Booking.findById(payment.bookingId).populate('field user');
    } else if (payment.status !== 'SUCCESS') {
      payment.status = 'FAILED';
      payment.responseCode = req.query.vnp_ResponseCode;
      payment.transactionStatus = req.query.vnp_TransactionStatus;
      payment.transactionNo = req.query.vnp_TransactionNo;
      payment.bankCode = req.query.vnp_BankCode;
      await payment.save();

      if (booking) {
        booking.paymentStatus = 'FAILED';
        booking.paymentMethod = 'VNPAY';
        await booking.save();
      }
    }

    const updatedPayment = await Payment.findById(payment._id);
    return res.json({
      success: isSuccess,
      message: isSuccess ? 'Thanh toan thanh cong.' : (verified.message || 'Thanh toan that bai.'),
      booking: booking ? await attachPaymentToBooking(booking) : null,
      payment: updatedPayment
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleVnpayIpn = async (req, res) => {
  try {
    const verified = vnpay.verifyIpnCall(req.query);
    if (!verified.isVerified) {
      return res.json({ RspCode: '97', Message: 'Invalid Checksum' });
    }

    const payment = await Payment.findOne({ txnRef: req.query.vnp_TxnRef });
    if (!payment) return res.json({ RspCode: '01', Message: 'Order not found' });

    if (payment.status === 'SUCCESS') {
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    const vnpAmount = normalizeAmount(Number(req.query.vnp_Amount || 0) / 100);
    if (vnpAmount !== normalizeAmount(payment.amount)) {
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }

    const isSuccess = req.query.vnp_ResponseCode === '00' && req.query.vnp_TransactionStatus === '00';
    if (isSuccess) {
      await applySuccessPayment(payment, req.query);
    } else {
      payment.status = 'FAILED';
      payment.responseCode = req.query.vnp_ResponseCode;
      payment.transactionStatus = req.query.vnp_TransactionStatus;
      payment.transactionNo = req.query.vnp_TransactionNo;
      payment.bankCode = req.query.vnp_BankCode;
      await payment.save();

      await Booking.findByIdAndUpdate(payment.bookingId, {
        paymentStatus: 'FAILED',
        paymentMethod: 'VNPAY'
      });
    }

    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    return res.json({ RspCode: '99', Message: error.message || 'Unknown error' });
  }
};
