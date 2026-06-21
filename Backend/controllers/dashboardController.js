const Booking = require('../models/Booking');
const Field = require('../models/Field');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const Review = require('../models/Review');

const PAID_STATUSES = ['paid', 'success', 'PAID', 'Paid'];
const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'playing',
  'completed',
  'cancel_requested',
  'Pending',
  'Confirmed',
  'Completed',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'COMPLETED'
];

const toDateString = (date) => date.toISOString().slice(0, 10);

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getRangeFromFilter = (filter) => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    return { start: startOfDay(now), end, days: 1 };
  }

  if (filter === '30d') {
    return { start: startOfDay(addDays(now, -29)), end, days: 30 };
  }

  if (filter === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, days: now.getDate() };
  }

  return { start: startOfDay(addDays(now, -6)), end, days: 7 };
};

const getAmount = (booking) => Number(booking.finalAmount || booking.totalPrice || 0);
const revenueExpression = {
  $cond: [
    { $gt: ['$finalAmount', 0] },
    '$finalAmount',
    { $ifNull: ['$totalPrice', 0] }
  ]
};

const createChartLabels = (start, days) => {
  const formatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' });
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const key = toDateString(date);
    return {
      key,
      label: days <= 7 ? formatter.format(date).replace('Th ', 'T') : `${date.getDate()}/${date.getMonth() + 1}`,
      revenue: 0,
      bookings: 0
    };
  });
};

const normalizeBooking = (booking) => ({
  _id: booking._id,
  user: booking.user,
  field: booking.field,
  date: booking.date,
  slots: booking.startTime && booking.endTime ? [`${booking.startTime} - ${booking.endTime}`] : [],
  totalPrice: getAmount(booking),
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  createdAt: booking.createdAt
});

const createActivityFromBooking = (booking) => ({
  type: 'booking',
  title: 'Đơn đặt sân mới',
  description: `${booking.user?.fullName || booking.customerName || 'Khách hàng'} đặt ${booking.field?.fieldName || 'sân'} lúc ${booking.startTime || ''}`,
  time: booking.createdAt
});

exports.getAdminDashboard = async (req, res) => {
  try {
    const { start, end, days } = getRangeFromFilter(req.query.range);
    const startKey = toDateString(start);
    const endKey = toDateString(end);
    const todayKey = toDateString(new Date());

    const bookingDateQuery = { date: { $gte: startKey, $lte: endKey } };
    const todayBookingQuery = { date: todayKey };
    const paidQuery = { paymentStatus: { $in: PAID_STATUSES } };

    const [
      totalUsers,
      totalBookings,
      todayPaidBookings,
      allPaidBookings,
      activeFields,
      activeVouchers,
      averageRatingResult,
      periodBookings,
      fields,
      recentBookings,
      topFieldRows,
      topUserRows,
      latestReviews
    ] = await Promise.all([
      User.countDocuments(),
      Booking.countDocuments(),
      Booking.find({ ...todayBookingQuery, ...paidQuery }).select('totalPrice finalAmount'),
      Booking.find(paidQuery).select('totalPrice finalAmount'),
      Field.countDocuments({ status: 'Active' }),
      Voucher.countDocuments({
        status: { $in: ['active', 'Active'] },
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      }).catch(() => 0),
      Review.aggregate([{ $group: { _id: null, average: { $avg: '$rating' } } }]).catch(() => []),
      Booking.find(bookingDateQuery).select('date paymentStatus totalPrice finalAmount'),
      Field.find().select('fieldName type image status').sort({ createdAt: -1 }).lean(),
      Booking.find().populate('user', 'fullName email avatar').populate('field', 'fieldName type image').sort({ createdAt: -1 }).limit(8).lean(),
      Booking.aggregate([
        { $group: { _id: '$field', totalBookings: { $sum: 1 }, revenue: { $sum: revenueExpression } } },
        { $sort: { totalBookings: -1, revenue: -1 } },
        { $limit: 5 }
      ]),
      Booking.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: '$user', totalBookings: { $sum: 1 }, totalSpent: { $sum: revenueExpression } } },
        { $sort: { totalSpent: -1, totalBookings: -1 } },
        { $limit: 5 }
      ]),
      Review.find().populate('user', 'fullName email avatar').populate('field', 'fieldName type image').sort({ createdAt: -1 }).limit(5).lean().catch(() => [])
    ]);

    const todayRevenue = todayPaidBookings.reduce((sum, booking) => sum + getAmount(booking), 0);
    const totalRevenue = allPaidBookings.reduce((sum, booking) => sum + getAmount(booking), 0);

    const chartMap = new Map(createChartLabels(start, days).map((item) => [item.key, item]));
    periodBookings.forEach((booking) => {
      const item = chartMap.get(booking.date);
      if (!item) return;
      item.bookings += 1;
      if (PAID_STATUSES.includes(booking.paymentStatus)) item.revenue += getAmount(booking);
    });

    const chartData = Array.from(chartMap.values()).map(({ label, revenue, bookings }) => ({ label, revenue, bookings }));
    const bookingCountByField = await Booking.aggregate([
      { $match: { ...todayBookingQuery, status: { $in: ACTIVE_BOOKING_STATUSES } } },
      { $group: { _id: '$field', todayBookingCount: { $sum: 1 } } }
    ]);
    const countMap = new Map(bookingCountByField.map((item) => [String(item._id), item.todayBookingCount]));

    const fieldStatus = fields.map((field) => {
      const todayBookingCount = countMap.get(String(field._id)) || 0;
      return {
        _id: field._id,
        fieldName: field.fieldName,
        type: field.type,
        image: field.image,
        status: field.status,
        todayBookingCount,
        occupancyRate: Math.min(Math.round((todayBookingCount / 12) * 100), 100)
      };
    });

    const fieldIds = topFieldRows.map((item) => item._id).filter(Boolean);
    const userIds = topUserRows.map((item) => item._id).filter(Boolean);
    const [topFieldDocs, topUserDocs] = await Promise.all([
      Field.find({ _id: { $in: fieldIds } }).select('fieldName type image').lean(),
      User.find({ _id: { $in: userIds } }).select('fullName email avatar').lean()
    ]);
    const fieldDocMap = new Map(topFieldDocs.map((field) => [String(field._id), field]));
    const userDocMap = new Map(topUserDocs.map((user) => [String(user._id), user]));

    const topFields = topFieldRows.map((item) => {
      const field = fieldDocMap.get(String(item._id)) || {};
      return {
        _id: item._id,
        fieldName: field.fieldName || 'Sân đã xóa',
        type: field.type || '',
        image: field.image || '',
        totalBookings: item.totalBookings,
        revenue: item.revenue
      };
    });

    const topUsers = topUserRows.map((item) => {
      const user = userDocMap.get(String(item._id)) || {};
      return {
        _id: item._id,
        fullName: user.fullName || 'Người dùng đã xóa',
        email: user.email || '',
        avatar: user.avatar || '',
        totalBookings: item.totalBookings,
        totalSpent: item.totalSpent
      };
    });

    const activityLogs = [
      ...recentBookings.slice(0, 5).map(createActivityFromBooking),
      ...latestReviews.slice(0, 3).map((review) => ({
        type: 'review',
        title: 'Đánh giá mới',
        description: `${review.user?.fullName || 'Khách hàng'} đánh giá ${review.rating} sao cho ${review.field?.fieldName || 'sân'}`,
        time: review.createdAt
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    res.json({
      stats: {
        totalUsers,
        totalBookings,
        todayRevenue,
        totalRevenue,
        activeFields,
        activeVouchers,
        averageRating: Number((averageRatingResult[0]?.average || 0).toFixed(1))
      },
      revenueChart: chartData,
      bookingChart: chartData.map(({ label, bookings }) => ({ label, bookings })),
      fieldStatus,
      recentBookings: recentBookings.map(normalizeBooking),
      topFields,
      topUsers,
      latestReviews,
      activityLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải dữ liệu dashboard.', error: error.message });
  }
};
