const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Field = require('../models/Field');

const COMPLETED_STATUSES = ['completed', 'Completed', 'COMPLETED', 'Hoàn thành', 'Đã hoàn thành', 'Da hoan thanh'];

const reviewPopulate = [
  { path: 'user', select: 'fullName email avatar' },
  { path: 'booking', select: 'date startTime endTime status paymentStatus totalPrice services' },
  { path: 'field', select: 'fieldName address image type' },
  { path: 'service', select: 'name image price' }
];

const normalizeObjectId = (value) => (value ? new mongoose.Types.ObjectId(value) : undefined);

const emitReviewUpdated = (req, fieldId) => {
  const io = req.app.get('io');
  if (io && fieldId) io.emit('review_updated', { fieldId: String(fieldId) });
};

const isCompletedBooking = (booking) => {
  const status = String(booking.status || '').trim().toLowerCase();
  return status === 'completed' ||
    status === 'hoàn thành' ||
    status === 'đã hoàn thành' ||
    status === 'da hoan thanh' ||
    COMPLETED_STATUSES.includes(booking.status);
};

const isValidRating = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5;
};

const validateReviewInput = ({ bookingId, rating, fieldQuality, serviceQuality, cleanliness, priceReasonable, comment }) => {
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) return 'Booking không hợp lệ.';
  const ratingFields = { rating, fieldQuality, serviceQuality, cleanliness, priceReasonable };
  if (Object.values(ratingFields).some((value) => !isValidRating(value))) {
    return 'Vui lòng chọn đầy đủ các tiêu chí từ 1 đến 5 sao.';
  }

  const normalizedComment = String(comment || '').trim();
  if (normalizedComment.length < 10) return 'Bình luận phải có ít nhất 10 ký tự.';
  if (normalizedComment.length > 500) return 'Bình luận không được vượt quá 500 ký tự.';
  return null;
};

const updateFieldRating = async (fieldId) => {
  if (!fieldId) return;
  const result = await Review.aggregate([
    { $match: { field: normalizeObjectId(fieldId), isHidden: { $ne: true } } },
    { $group: { _id: '$field', ratingAverage: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
  ]);
  const summary = result[0] || { ratingAverage: 0, ratingCount: 0 };
  await Field.findByIdAndUpdate(fieldId, {
    ratingAverage: Number((summary.ratingAverage || 0).toFixed(1)),
    ratingCount: summary.ratingCount || 0
  });
};

exports.createReview = async (req, res) => {
  try {
    const {
      bookingId,
      fieldId,
      serviceId,
      rating,
      fieldQuality,
      serviceQuality,
      cleanliness,
      priceReasonable,
      comment,
      wouldRecommend,
      images
    } = req.body;

    const validationError = validateReviewInput({
      bookingId,
      rating,
      fieldQuality,
      serviceQuality,
      cleanliness,
      priceReasonable,
      comment
    });
    if (validationError) return res.status(400).json({ message: validationError });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy booking.' });
    if (String(booking.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Bạn không có quyền đánh giá booking này.' });
    }
    if (!isCompletedBooking(booking)) {
      return res.status(400).json({ message: 'Chỉ booking đã hoàn thành mới được đánh giá.' });
    }

    const targetField = fieldId || booking.field;
    if (fieldId && String(fieldId) !== String(booking.field)) {
      return res.status(400).json({ message: 'Sân đánh giá không khớp với booking.' });
    }

    if (serviceId) {
      const bookedService = (booking.services || []).some((item) => String(item.serviceId) === String(serviceId));
      if (!bookedService) return res.status(400).json({ message: 'Dịch vụ này không nằm trong booking.' });
    }

    const existingReview = await Review.findOne({ user: req.user.id, booking: bookingId });
    if (existingReview || booking.reviewed || booking.isReviewed) {
      return res.status(409).json({ message: 'Booking này đã được đánh giá.', review: existingReview });
    }

    const review = await Review.create({
      user: req.user.id,
      booking: bookingId,
      field: normalizeObjectId(targetField),
      service: normalizeObjectId(serviceId),
      rating: Number(rating),
      fieldQuality: Number(fieldQuality),
      serviceQuality: Number(serviceQuality),
      cleanliness: Number(cleanliness),
      priceReasonable: Number(priceReasonable),
      comment: String(comment).trim(),
      wouldRecommend: Boolean(wouldRecommend),
      images: Array.isArray(images) ? images.slice(0, 3).filter(Boolean) : []
    });

    booking.reviewed = true;
    booking.isReviewed = true;
    booking.reviewId = review._id;
    await booking.save();
    await updateFieldRating(targetField);
    emitReviewUpdated(req, targetField);

    const populated = await Review.findById(review._id).populate(reviewPopulate);
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Booking này đã được đánh giá.' });
    return res.status(500).json({ message: error.message });
  }
};

exports.getFieldReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ field: req.params.fieldId, isHidden: { $ne: true } }).populate(reviewPopulate).sort({ createdAt: -1 });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getServiceReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ service: req.params.serviceId, isHidden: { $ne: true } }).populate(reviewPopulate).sort({ createdAt: -1 });
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
    const { rating, fieldQuality, serviceQuality, cleanliness, priceReasonable, comment, wouldRecommend, images } = req.body;
    const validationError = validateReviewInput({
      bookingId: req.params.id,
      rating,
      fieldQuality,
      serviceQuality,
      cleanliness,
      priceReasonable,
      comment
    });
    if (validationError && !mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Đánh giá không hợp lệ.' });
    if ([rating, fieldQuality, serviceQuality, cleanliness, priceReasonable].some((value) => value !== undefined && !isValidRating(value))) {
      return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5 sao.' });
    }
    const normalizedComment = String(comment || '').trim();
    if (normalizedComment && (normalizedComment.length < 10 || normalizedComment.length > 500)) {
      return res.status(400).json({ message: 'Bình luận phải từ 10 đến 500 ký tự.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
    if (String(review.user) !== String(req.user.id)) return res.status(403).json({ message: 'Bạn không có quyền sửa đánh giá này.' });

    if (rating !== undefined) review.rating = Number(rating);
    if (fieldQuality !== undefined) review.fieldQuality = Number(fieldQuality);
    if (serviceQuality !== undefined) review.serviceQuality = Number(serviceQuality);
    if (cleanliness !== undefined) review.cleanliness = Number(cleanliness);
    if (priceReasonable !== undefined) review.priceReasonable = Number(priceReasonable);
    if (normalizedComment) review.comment = normalizedComment;
    if (wouldRecommend !== undefined) review.wouldRecommend = Boolean(wouldRecommend);
    if (Array.isArray(images)) review.images = images.slice(0, 3).filter(Boolean);
    await review.save();
    await updateFieldRating(review.field);
    emitReviewUpdated(req, review.field);

    const populated = await Review.findById(review._id).populate(reviewPopulate);
    return res.json({ success: true, data: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });

    const isOwner = String(review.user) === String(req.user.id);
    const role = String(req.user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'super admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Bạn không có quyền xóa đánh giá này.' });

    const fieldId = review.field;
    if (isAdmin && !isOwner) {
      review.isHidden = true;
      review.hiddenReason = 'Admin ẩn đánh giá';
      review.hiddenAt = new Date();
      await review.save();
      await updateFieldRating(fieldId);
      emitReviewUpdated(req, fieldId);
      return res.json({ success: true, message: 'Đã ẩn đánh giá.' });
    }

    await review.deleteOne();
    await Booking.findByIdAndUpdate(review.booking, { reviewed: false, isReviewed: false, $unset: { reviewId: '' } });
    await updateFieldRating(fieldId);
    emitReviewUpdated(req, fieldId);
    return res.json({ success: true, message: 'Đã xóa đánh giá.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.adminToggleReviewVisibility = async (req, res) => {
  try {
    const { isHidden, hiddenReason } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });

    review.isHidden = Boolean(isHidden);
    review.hiddenReason = review.isHidden ? String(hiddenReason || 'Admin ẩn đánh giá').trim() : '';
    review.hiddenAt = review.isHidden ? new Date() : undefined;
    await review.save();
    await updateFieldRating(review.field);
    emitReviewUpdated(req, review.field);

    const populated = await Review.findById(review._id).populate(reviewPopulate);
    return res.json({ success: true, data: populated });
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
