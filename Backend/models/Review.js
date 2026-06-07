const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 }
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
