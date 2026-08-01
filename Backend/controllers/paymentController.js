const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Field = require('../models/Field');
const { vnpay, vnpayConfig } = require('../config/vnpay');
const { createNotification } = require('../services/notificationService');
const { markVoucherUsed } = require('../services/voucherService');
const { getSocket, emitToAdmin } = require('../utils/socket');

const paidStatuses = ['PAID', 'Paid'];
const cancelledStatuses = ['CANCELLED', 'Cancelled'];
const pendingPaymentStatuses = ['UNPAID', 'PENDING', 'Pending', 'FAILED'];

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
};

const normalizeAmount = (amount) => Math.round(Number(amount || 0));
const getBookingPayableAmount = (booking) => normalizeAmount(
  booking?.finalAmount ?? booking?.totalPrice
);
const getFieldName = (field) => field?.fieldName || field?.name || 'sân';

const normalizeTime = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};

const addMinutes = (time, minutesToAdd) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  const totalMinutes = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
};

const expandBookingSlots = (booking) => {
  const slots = [];
  let current = normalizeTime(booking.startTime);
  const endTime = normalizeTime(booking.endTime);
  while (current < endTime) {
    slots.push(current);
    current = addMinutes(current, 30);
  }
  return slots;
};

const createTxnRef = (bookingId) => {
  return `AH${Date.now()}${String(bookingId).slice(-6)}`;
};

const attachPaymentToBooking = async (booking) => {
  const payment = await Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
  const bookingData = booking.toObject ? booking.toObject() : booking;
  return { ...bookingData, payment };
};

const emitScheduleRefresh = (booking, action) => {
  if (!booking) return;
  emitToAdmin('schedule:refresh', {
    message: 'Lich san da duoc cap nhat',
    bookingId: booking._id,
    fieldId: String(booking.field),
    date: booking.date,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    action
  });
};

const applySuccessPayment = async (payment, query, io) => {
  const shouldNotify = payment.status !== 'SUCCESS';

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
    const socket = io || getSocket();
    if (socket && shouldNotify) {
      socket.emit('slot_booked_success', {
        bookingId: booking._id,
        fieldId: String(booking.field),
        date: booking.date,
        slots: expandBookingSlots(booking),
        slotStatus: 'booked'
      });
    }
    if (shouldNotify) {
      emitScheduleRefresh(booking, 'booking:paid');
    }
    if (shouldNotify) {
      await markVoucherUsed(booking, io);
    }

    if (shouldNotify) {
      const field = await Field.findById(booking.field);
      await createNotification({
        user: booking.user,
        title: 'Đặt sân thành công',
        message: `Bạn đã đặt sân ${getFieldName(field)} vào lúc ${booking.startTime} ngày ${booking.date}.`,
        type: 'booking',
        relatedId: booking._id,
        relatedModel: 'Booking',
        io
      });

      await createNotification({
        user: booking.user,
        title: 'Thanh toán thành công',
        message: 'Thanh toán cho đơn đặt sân của bạn đã thành công.',
        type: 'payment',
        relatedId: booking._id,
        relatedModel: 'Booking',
        io
      });
    }
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
      return res.status(400).json({ success: false, message: 'Thoi gian giu cho 3 phut da het. Vui long dat lai.' });
    }
    if (paidStatuses.includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Booking da duoc thanh toan.' });
    }
    if (!pendingPaymentStatuses.includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Booking khong o trang thai can thanh toan.' });
    }

    const bookingAmount = getBookingPayableAmount(booking);
    if (amount !== undefined && normalizeAmount(amount) !== bookingAmount) {
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán không khớp với booking.' });
    }

    let existingPending = await Payment.findOne({
      bookingId: booking._id,
      method: 'VNPAY',
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    const isNewPendingPayment = !existingPending;
    if (existingPending && normalizeAmount(existingPending.amount) !== bookingAmount) {
      existingPending.amount = bookingAmount;
      existingPending.txnRef = createTxnRef(booking._id);
      existingPending.orderInfo = `Thanh toan booking ${booking._id}`;
      await existingPending.save();
    }
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
    if (isNewPendingPayment) {
      await createNotification({
        user: booking.user,
        title: 'Chờ thanh toán',
        message: 'Đơn đặt sân của bạn đang chờ thanh toán.',
        type: 'payment',
        relatedId: booking._id,
        relatedModel: 'Booking',
        io: req.app.get('io')
      });
    }

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
      booking = await applySuccessPayment(payment, req.query, req.app.get('io'));
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
