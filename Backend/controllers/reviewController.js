const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

const COMPLETED_STATUSES = ['Completed', 'Đã hoàn thành', 'Da hoan thanh'];

const reviewPopulate = [
  { path: 'user', select: 'fullName email avatar' },
  { path: 'booking', select: 'date startTime endTime status paymentStatus totalPrice services' },
  { path: 'field', select: 'fieldName address image type' },
  { path: 'service', select: 'name image price' }
];

const normalizeObjectId = (value) => (value ? new mongoose.Types.ObjectId(value) : undefined);
const isCompletedBooking = (booking) => COMPLETED_STATUSES.includes(booking.status);

const validateReviewInput = ({ bookingId, rating, comment }) => {
  const numericRating = Number(rating);
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) return 'Booking khong hop le.';
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) return 'Rating phai tu 1 den 5 sao.';
  if (!String(comment || '').trim()) return 'Noi dung danh gia khong duoc de trong.';
  return null;
};

exports.createReview = async (req, res) => {
  try {
    const { bookingId, fieldId, serviceId, rating, comment } = req.body;
    const validationError = validateReviewInput({ bookingId, rating, comment });
    if (validationError) return res.status(400).json({ message: validationError });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay booking.' });
    if (String(booking.user) !== String(req.user.id)) return res.status(403).json({ message: 'Ban khong co quyen danh gia booking nay.' });
    if (!isCompletedBooking(booking)) return res.status(400).json({ message: 'Chi booking da hoan thanh moi duoc danh gia.' });

    const targetField = fieldId || booking.field;
    if (fieldId && String(fieldId) !== String(booking.field)) return res.status(400).json({ message: 'San danh gia khong khop voi booking.' });

    if (serviceId) {
      const bookedService = (booking.services || []).some((item) => String(item.serviceId) === String(serviceId));
      if (!bookedService) return res.status(400).json({ message: 'Dich vu nay khong nam trong booking.' });
    }

    const existingReview = await Review.findOne({ user: req.user.id, booking: bookingId });
    if (existingReview) {
      return res.status(409).json({ message: 'Booking nay da duoc danh gia. Vui long sua danh gia hien co.', review: existingReview });
    }

    const review = await Review.create({
      user: req.user.id,
      booking: bookingId,
      field: normalizeObjectId(targetField),
      service: normalizeObjectId(serviceId),
      rating: Number(rating),
      comment: String(comment).trim()
    });

    const populated = await Review.findById(review._id).populate(reviewPopulate);
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Booking nay da duoc danh gia.' });
    return res.status(500).json({ message: error.message });
  }
};

exports.getFieldReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ field: req.params.fieldId }).populate(reviewPopulate).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getServiceReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ service: req.params.serviceId }).populate(reviewPopulate).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user.id }).populate(reviewPopulate).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) return res.status(400).json({ message: 'Rating phai tu 1 den 5 sao.' });
    if (!String(comment || '').trim()) return res.status(400).json({ message: 'Noi dung danh gia khong duoc de trong.' });

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Khong tim thay danh gia.' });
    if (String(review.user) !== String(req.user.id)) return res.status(403).json({ message: 'Ban khong co quyen sua danh gia nay.' });

    review.rating = numericRating;
    review.comment = String(comment).trim();
    await review.save();

    const populated = await Review.findById(review._id).populate(reviewPopulate);
    return res.json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Khong tim thay danh gia.' });

    const isOwner = String(review.user) === String(req.user.id);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'Super Admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Ban khong co quyen xoa danh gia nay.' });

    await review.deleteOne();
    return res.json({ success: true, message: 'Da xoa danh gia.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.adminGetReviews = async (req, res) => {
  try {
    const { fieldId, rating, from, to } = req.query;
    const query = {};
    if (fieldId) query.field = fieldId;
    if (rating) query.rating = Number(rating);
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const reviews = await Review.find(query).populate(reviewPopulate).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
