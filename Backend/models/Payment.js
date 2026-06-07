const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['VNPAY', 'VIETQR'], required: true },
  provider: { type: String, default: 'VNPAY' },
  transactionNo: String,
  bankCode: String,
  orderInfo: String,
  responseCode: String,
  transactionStatus: String,
  txnRef: { type: String, unique: true },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
