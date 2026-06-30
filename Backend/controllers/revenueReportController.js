const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');

const PAID_STATUSES = ['paid', 'success', 'PAID', 'Paid', 'SUCCESS'];
const UNPAID_STATUSES = ['pending', 'unpaid', 'Pending', 'UNPAID', 'PENDING', 'deposit'];
const REFUNDED_STATUSES = ['refunded', 'REFUNDED'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'Cancelled', 'CANCELLED'];

const paymentStatusGroups = {
  paid: PAID_STATUSES,
  unpaid: UNPAID_STATUSES,
  refunded: REFUNDED_STATUSES,
  cancelled: ['cancelled', 'CANCELLED', 'failed', 'FAILED']
};

const revenueExpression = {
  $cond: [
    { $gt: [{ $ifNull: ['$finalAmount', 0] }, 0] },
    '$finalAmount',
    { $ifNull: ['$totalPrice', 0] }
  ]
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isValidMonthKey = (value) => /^\d{4}-\d{2}$/.test(String(value || ''));

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
};

const getLastDayOfMonth = (month) => {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex, 0).getDate();
};

const normalizeFilters = (query) => {
  const errors = [];
  const filters = {};
  const defaultRange = getDefaultRange();

  if (query.month) {
    if (!isValidMonthKey(query.month)) errors.push('Thang khong hop le. Dinh dang dung la YYYY-MM.');
    filters.month = String(query.month);
    filters.startDate = `${filters.month}-01`;
    filters.endDate = `${filters.month}-${String(getLastDayOfMonth(filters.month)).padStart(2, '0')}`;
  } else {
    filters.startDate = query.startDate || defaultRange.startDate;
    filters.endDate = query.endDate || defaultRange.endDate;
  }

  if (!isValidDateKey(filters.startDate)) errors.push('Ngay bat dau khong hop le.');
  if (!isValidDateKey(filters.endDate)) errors.push('Ngay ket thuc khong hop le.');
  if (filters.startDate > filters.endDate) errors.push('Ngay bat dau khong duoc lon hon ngay ket thuc.');

  filters.field = String(query.field || '').trim();
  filters.fieldType = String(query.fieldType || '').trim();
  filters.paymentStatus = String(query.paymentStatus || '').trim().toLowerCase();
  filters.search = String(query.search || '').trim();
  filters.sortBy = ['revenue', 'date', 'customer'].includes(query.sortBy) ? query.sortBy : 'date';
  filters.sortOrder = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  filters.page = Math.max(Number(query.page) || 1, 1);
  filters.exportMode = String(query.export || '').toLowerCase() === 'true';
  filters.limit = Math.min(Math.max(Number(query.limit) || 10, 1), filters.exportMode ? 5000 : 100);

  if (filters.field && !mongoose.Types.ObjectId.isValid(filters.field)) errors.push('San khong hop le.');
  if (filters.paymentStatus && !paymentStatusGroups[filters.paymentStatus]) {
    errors.push('Trang thai thanh toan khong hop le.');
  }

  return { filters, errors };
};

const buildBasePipeline = (filters) => {
  const match = { date: { $gte: filters.startDate, $lte: filters.endDate } };

  if (filters.field) match.field = new mongoose.Types.ObjectId(filters.field);

  if (filters.paymentStatus === 'cancelled') {
    match.$or = [
      { status: { $in: CANCELLED_BOOKING_STATUSES } },
      { paymentStatus: { $in: paymentStatusGroups.cancelled } }
    ];
  } else if (filters.paymentStatus) {
    match.paymentStatus = { $in: paymentStatusGroups[filters.paymentStatus] };
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'fields',
        localField: 'field',
        foreignField: '_id',
        as: 'fieldDoc'
      }
    },
    { $unwind: { path: '$fieldDoc', preserveNullAndEmptyArrays: true } }
  ];

  if (filters.fieldType) pipeline.push({ $match: { 'fieldDoc.type': filters.fieldType } });

  pipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDoc'
      }
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        revenueAmount: revenueExpression,
        customerDisplayName: {
          $ifNull: ['$userDoc.fullName', { $ifNull: ['$customerName', 'Khach vang lai'] }]
        },
        isPaid: { $in: ['$paymentStatus', PAID_STATUSES] },
        isUnpaid: { $in: ['$paymentStatus', UNPAID_STATUSES] },
        isRefunded: { $in: ['$paymentStatus', REFUNDED_STATUSES] },
        isCancelled: {
          $or: [
            { $in: ['$status', CANCELLED_BOOKING_STATUSES] },
            { $in: ['$paymentStatus', paymentStatusGroups.cancelled] }
          ]
        },
        monthKey: { $substr: ['$date', 0, 7] }
      }
    },
    {
      $addFields: {
        bookingCode: { $toUpper: { $substr: [{ $toString: '$_id' }, 16, 8] } }
      }
    }
  );

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), 'i');
    pipeline.push({
      $match: {
        $or: [
          { customerDisplayName: regex },
          { customerName: regex },
          { bookingCode: regex },
          { 'userDoc.email': regex },
          { _id: mongoose.Types.ObjectId.isValid(filters.search) ? new mongoose.Types.ObjectId(filters.search) : null }
        ]
      }
    });
  }

  return pipeline;
};

const getSortStage = (filters) => {
  if (filters.sortBy === 'revenue') return { revenueAmount: filters.sortOrder, date: -1 };
  if (filters.sortBy === 'customer') return { customerDisplayName: filters.sortOrder, date: -1 };
  return { date: filters.sortOrder, startTime: filters.sortOrder };
};

const formatBookingRow = (booking) => ({
  _id: booking._id,
  bookingCode: booking.bookingCode || String(booking._id).slice(-8).toUpperCase(),
  customerName: booking.customerDisplayName,
  customerEmail: booking.userDoc?.email || '',
  fieldName: booking.fieldDoc?.fieldName || 'San da xoa',
  fieldType: booking.fieldDoc?.type || '',
  date: booking.date,
  timeRange: [booking.startTime, booking.endTime].filter(Boolean).join(' - '),
  totalAmount: booking.revenueAmount || 0,
  paymentStatus: booking.paymentStatus,
  bookingStatus: booking.status
});

exports.getRevenueReport = async (req, res) => {
  try {
    const { filters, errors } = normalizeFilters(req.query);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const basePipeline = buildBasePipeline(filters);
    const skip = (filters.page - 1) * filters.limit;
    const useMonthlyRevenue = filters.startDate.slice(0, 7) !== filters.endDate.slice(0, 7);

    const [
      reportResult,
      fields,
      fieldTypes
    ] = await Promise.all([
      Booking.aggregate([
        ...basePipeline,
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalBookings: { $sum: 1 },
                  totalRevenue: { $sum: { $cond: ['$isPaid', '$revenueAmount', 0] } },
                  paidBookings: { $sum: { $cond: ['$isPaid', 1, 0] } },
                  unpaidBookings: { $sum: { $cond: ['$isUnpaid', 1, 0] } },
                  refundedBookings: { $sum: { $cond: ['$isRefunded', 1, 0] } },
                  cancelledBookings: { $sum: { $cond: ['$isCancelled', 1, 0] } }
                }
              }
            ],
            topFields: [
              { $match: { isPaid: true } },
              {
                $group: {
                  _id: '$field',
                  fieldName: { $first: '$fieldDoc.fieldName' },
                  fieldType: { $first: '$fieldDoc.type' },
                  revenue: { $sum: '$revenueAmount' },
                  bookings: { $sum: 1 }
                }
              },
              { $sort: { revenue: -1, bookings: -1 } },
              { $limit: 8 }
            ],
            topHours: [
              { $match: { isPaid: true } },
              {
                $group: {
                  _id: '$startTime',
                  revenue: { $sum: '$revenueAmount' },
                  bookings: { $sum: 1 }
                }
              },
              { $sort: { bookings: -1, revenue: -1 } },
              { $limit: 8 }
            ],
            topCustomers: [
              { $match: { isPaid: true } },
              {
                $group: {
                  _id: { $ifNull: ['$user', '$customerDisplayName'] },
                  customerName: { $first: '$customerDisplayName' },
                  email: { $first: '$userDoc.email' },
                  revenue: { $sum: '$revenueAmount' },
                  bookings: { $sum: 1 }
                }
              },
              { $sort: { revenue: -1, bookings: -1 } },
              { $limit: 8 }
            ],
            revenueTrend: [
              { $match: { isPaid: true } },
              {
                $group: {
                  _id: useMonthlyRevenue ? '$monthKey' : '$date',
                  revenue: { $sum: '$revenueAmount' },
                  bookings: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            tableRows: [
              { $sort: getSortStage(filters) },
              { $skip: skip },
              { $limit: filters.limit },
              {
                $project: {
                  _id: 1,
                  bookingCode: 1,
                  customerDisplayName: 1,
                  userDoc: { email: 1 },
                  fieldDoc: { fieldName: 1, type: 1 },
                  date: 1,
                  startTime: 1,
                  endTime: 1,
                  revenueAmount: 1,
                  paymentStatus: 1,
                  status: 1
                }
              }
            ],
            totalRows: [{ $count: 'count' }]
          }
        }
      ]),
      Field.find().select('fieldName type').sort({ fieldName: 1 }).lean(),
      Field.distinct('type')
    ]);

    const data = reportResult[0] || {};
    const summary = data.summary?.[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      paidBookings: 0,
      unpaidBookings: 0,
      refundedBookings: 0,
      cancelledBookings: 0
    };
    const totalRows = data.totalRows?.[0]?.count || 0;

    summary.averageRevenuePerBooking = summary.paidBookings > 0
      ? Math.round(summary.totalRevenue / summary.paidBookings)
      : 0;
    summary.paymentSuccessRate = summary.totalBookings > 0
      ? Number(((summary.paidBookings / summary.totalBookings) * 100).toFixed(1))
      : 0;

    return res.json({
      filters: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        month: filters.month || ''
      },
      summary,
      charts: {
        topFields: (data.topFields || []).map((item) => ({
          fieldName: item.fieldName || 'San da xoa',
          fieldType: item.fieldType || '',
          revenue: item.revenue || 0,
          bookings: item.bookings || 0
        })),
        topHours: (data.topHours || []).map((item) => ({
          hour: item._id || 'Khac',
          revenue: item.revenue || 0,
          bookings: item.bookings || 0
        })),
        topCustomers: (data.topCustomers || []).map((item) => ({
          customerName: item.customerName || 'Khach vang lai',
          email: item.email || '',
          revenue: item.revenue || 0,
          bookings: item.bookings || 0
        })),
        revenueTrend: (data.revenueTrend || []).map((item) => ({
          label: item._id,
          revenue: item.revenue || 0,
          bookings: item.bookings || 0
        }))
      },
      rows: (data.tableRows || []).map(formatBookingRow),
      pagination: {
        total: totalRows,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.max(Math.ceil(totalRows / filters.limit), 1)
      },
      options: {
        fields: fields.map((field) => ({ _id: field._id, fieldName: field.fieldName, type: field.type })),
        fieldTypes: fieldTypes.filter(Boolean).sort()
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Khong the tai bao cao doanh thu.', error: error.message });
  }
};
