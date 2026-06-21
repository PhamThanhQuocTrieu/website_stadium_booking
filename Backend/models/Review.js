const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  fieldQuality: { type: Number, required: true, min: 1, max: 5 },
  serviceQuality: { type: Number, required: true, min: 1, max: 5 },
  cleanliness: { type: Number, required: true, min: 1, max: 5 },
  priceReasonable: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  wouldRecommend: { type: Boolean, default: true },
  images: [{ type: String, trim: true }],
  isHidden: { type: Boolean, default: false },
  hiddenReason: { type: String, trim: true, default: '' },
  hiddenAt: Date
}, { timestamps: true });

reviewSchema.index(
  { user: 1, booking: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $exists: true },
      booking: { $exists: true }
    }
  }
);
reviewSchema.index({ field: 1, createdAt: -1 });
reviewSchema.index({ service: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
