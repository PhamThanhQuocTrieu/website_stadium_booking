const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const UserVoucher = require('../models/UserVoucher');
const Voucher = require('../models/Voucher');
const Policy = require('../models/Policy');

const SYSTEM_PROMPT = `Bạn là trợ lý AI của ArenaHub - hệ thống đặt sân thể thao.
Nhiệm vụ:
- Hỗ trợ khách hàng tư vấn đặt sân.
- Gợi ý sân phù hợp theo môn thể thao, địa điểm, khung giờ và ngân sách.
- Trả lời về giá sân.
- Trả lời chính sách hủy sân.
- Trả lời phương thức thanh toán.
- Trả lời về voucher.
- Trả lời tình trạng giờ trống dựa trên dữ liệu hệ thống.
- Nếu khách hỏi vấn đề ngoài phạm vi hệ thống thì lịch sự từ chối.
- Nếu khách có vấn đề phức tạp thì hướng dẫn liên hệ admin.

Quy tắc:
- Luôn trả lời bằng tiếng Việt có dấu.
- Chỉ trả lời dựa trên context dữ liệu ArenaHub được cung cấp và kiến thức chung về quy trình đặt sân.
- Không bịa giá, sân, voucher hoặc lịch trống nếu context không có.
- Trả lời ngắn gọn, rõ ràng.
- Nếu không chắc chắn, thêm câu: "Tôi chưa chắc về thông tin này, bạn có muốn chuyển sang admin không?"`;

const AI_OPERATION_LIMITS = `Gioi han bat buoc cua tro ly AI ArenaHub:
- Chi duoc goi y san, cung cap thong tin san, bang gia va khung gio trong.
- Duoc huong dan nguoi dung tu thao tac dat san tren giao dien.
- Tuyet doi khong nhan dat san, giu san, tao don, xac nhan don, huy don hoac thanh toan thay nguoi dung.
- Khong duoc noi rang da dat san, da giu san, da tao don hoac da thanh toan.
- Neu nguoi dung yeu cau dat san dum, giu san ho, tao don giup hoac thanh toan giup, phai tu choi lich su va nhac nguoi dung tu chon san, chon khung gio trong roi bam dat san tren giao dien.`;

const BOOKING_ACTION_REFUSAL = 'Tôi có thể gợi ý sân phù hợp, kiểm tra khung giờ trống và hướng dẫn bạn cách đặt sân, nhưng tôi không thể đặt sân, giữ sân, tạo đơn hoặc thanh toán thay bạn. Bạn vui lòng chọn sân và khung giờ trống trên giao diện ArenaHub, sau đó bấm đặt sân để tự xác nhận nhé.';

const MAX_HISTORY = 12;
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

const toId = (value) => value?.id || value?._id || value;
const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `${number.toLocaleString('vi-VN')} VND` : '';
};

const getVietnamDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const parseBudget = (text) => {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:duoi|toi da|<=|nho hon)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|trieu|m)?/);
  if (!match) return null;
  const raw = Number(String(match[1]).replace(',', '.'));
  if (!Number.isFinite(raw)) return null;
  const unit = match[2] || '';
  if (['k', 'nghin', 'ngan'].includes(unit)) return raw * 1000;
  if (unit === 'trieu' || unit === 'm') return raw * 1000000;
  return raw;
};

const detectSportType = (message) => {
  const text = normalizeText(message);
  if (text.includes('pickleball')) return 'Pickleball';
  if (text.includes('tennis')) return 'Tennis';
  if (text.includes('cau long') || text.includes('badminton')) return 'Cau long';
  if (text.includes(`cau l\u00f4ng`) || text.includes(`c\u1ea7u long`)) return 'Cau long';
  if (text.includes('bong da') || text.includes('football') || text.includes('soccer')) return 'Bong da';
  if (text.includes(`bong \u0111a`) || text.includes(`b\u00f3ng da`)) return 'Bong da';
  return null;
};

const detectTimeRange = (message) => {
  const text = normalizeText(message);
  if (text.includes('toi') || text.includes('buoi toi')) return { start: '18:00', end: '22:00', label: 'buoi toi' };
  if (text.includes('sang') || text.includes('buoi sang')) return { start: '05:00', end: '11:00', label: 'buoi sang' };
  if (text.includes('chieu') || text.includes('buoi chieu')) return { start: '13:00', end: '18:00', label: 'buoi chieu' };
  const match = text.match(/(\d{1,2})(?::|h)?(\d{2})?\s*(?:-|den|toi)\s*(\d{1,2})(?::|h)?(\d{2})?/);
  if (!match) return null;
  const start = `${String(match[1]).padStart(2, '0')}:${match[2] || '00'}`;
  const end = `${String(match[3]).padStart(2, '0')}:${match[4] || '00'}`;
  return { start, end, label: `${start}-${end}` };
};

const detectDate = (message) => {
  const text = normalizeText(message);
  const today = new Date();
  if (text.includes('hom nay') || text.includes('toi nay')) return getVietnamDateString(today);
  if (text.includes('ngay mai') || text.includes('toi mai')) {
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return getVietnamDateString(tomorrow);
  }
  const match = text.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?/);
  if (!match) return null;
  if (match[1]) return match[1];
  const day = String(match[2]).padStart(2, '0');
  const month = String(match[3]).padStart(2, '0');
  const year = match[4] || new Date().getFullYear();
  return `${year}-${month}-${day}`;
};

const isBookingActionRequest = (message) => {
  const text = normalizeText(message);
  const actionPattern = /(dat san|giu san|giu cho|tao don|xac nhan don|book san|booking|thanh toan)/;
  const delegatePattern = /(dum|giup|ho toi|cho toi|luon di|lam giup|dat ho|giu ho|tao giup|thanh toan giup)/;
  return actionPattern.test(text) && delegatePattern.test(text);
};

const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const overlaps = (aStart, aEnd, bStart, bEnd) => timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);

const sportRegex = (sportType) => {
  if (!sportType) return undefined;
  const variants = {
    'Bong da': ['Bong da', 'Bóng đá', 'BÃ³ng Ä‘Ã¡'],
    'Cau long': ['Cau long', 'Cầu lông', 'Cáº§u lÃ´ng'],
    Pickleball: ['Pickleball'],
    Tennis: ['Tennis']
  }[sportType] || [sportType];
  return new RegExp(variants.map(escapeRegex).join('|'), 'i');
};

const serializeField = (field) => ({
  id: field._id,
  fieldName: field.fieldName,
  type: field.type,
  address: field.address,
  status: field.status,
  pricingRules: (field.pricingRules || []).map((rule) => ({
    ruleName: rule.ruleName,
    startTime: rule.startTime,
    endTime: rule.endTime,
    price: formatCurrency(rule.price),
    dayType: rule.dayType,
    isPeakHour: rule.isPeakHour
  }))
});

const getRelevantFields = async ({ message, limit = 8 }) => {
  const sportType = detectSportType(message);
  const budget = parseBudget(message);
  const timeRange = detectTimeRange(message);
  const query = { status: { $in: ['Active', 'active'] } };
  const typeRegex = sportRegex(sportType);
  if (typeRegex) query.type = typeRegex;

  const fields = await Field.find(query).sort({ isFeatured: -1, ratingAverage: -1 }).limit(30).lean();
  const filtered = fields.filter((field) => {
    const rules = field.pricingRules || [];
    if (!budget && !timeRange) return true;
    return rules.some((rule) => {
      const priceOk = !budget || Number(rule.price || 0) <= budget;
      const timeOk = !timeRange || overlaps(rule.startTime, rule.endTime, timeRange.start, timeRange.end);
      return priceOk && timeOk;
    });
  });

  return filtered.slice(0, limit).map(serializeField);
};

const getAvailabilityContext = async ({ message }) => {
  const date = detectDate(message) || getVietnamDateString();
  const timeRange = detectTimeRange(message) || { start: '18:00', end: '22:00', label: 'buoi toi' };
  const sportType = detectSportType(message);
  const fieldQuery = { status: { $in: ['Active', 'active'] } };
  const typeRegex = sportRegex(sportType);
  if (typeRegex) fieldQuery.type = typeRegex;

  const fields = await Field.find(fieldQuery).limit(20).lean();
  const bookings = await Booking.find({
    field: { $in: fields.map((field) => field._id) },
    date,
    status: { $in: ACTIVE_BOOKING_STATUSES }
  }).select('field date startTime endTime status paymentStatus').lean();

  const busyByField = bookings.reduce((map, booking) => {
    const fieldId = String(booking.field);
    if (!map[fieldId]) map[fieldId] = [];
    if (overlaps(booking.startTime, booking.endTime, timeRange.start, timeRange.end)) {
      map[fieldId].push({
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        paymentStatus: booking.paymentStatus
      });
    }
    return map;
  }, {});

  return {
    date,
    checkedTimeRange: `${timeRange.start}-${timeRange.end}`,
    availableFields: fields
      .filter((field) => !busyByField[String(field._id)]?.length)
      .slice(0, 8)
      .map(serializeField),
    busyFields: fields
      .filter((field) => busyByField[String(field._id)]?.length)
      .slice(0, 8)
      .map((field) => ({
        ...serializeField(field),
        busySlots: busyByField[String(field._id)]
      }))
  };
};

const getUserVoucherContext = async (userId) => {
  const now = new Date();
  const rows = await UserVoucher.find({ userId })
    .populate('voucherId')
    .sort({ assignedAt: -1 })
    .limit(12)
    .lean();

  const assigned = rows
    .filter((row) => row.voucherId)
    .map((row) => ({
      code: row.code || row.voucherId.code,
      discount: row.voucherId.discountType === 'fixed'
        ? formatCurrency(row.voucherId.discountValue)
        : `${row.voucherId.discountValue || row.voucherId.discountPercent || 0}%`,
      expiredAt: row.voucherId.endDate,
      status: row.voucherId.endDate && new Date(row.voucherId.endDate) < now ? 'expired' : row.status
    }));

  const publicVouchers = await Voucher.find({
    applyType: { $in: ['all', 'field', 'sport_type', 'time_slot', 'weekend'] },
    status: { $in: ['active', 'Active'] },
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 }).limit(8).lean();

  return {
    assigned,
    publicAvailable: publicVouchers.map((voucher) => ({
      code: voucher.code,
      discount: voucher.discountType === 'fixed'
        ? formatCurrency(voucher.discountValue)
        : `${voucher.discountValue || voucher.discountPercent || 0}%`,
      expiredAt: voucher.endDate,
      applyType: voucher.applyType
    }))
  };
};

const getBookingContext = async ({ bookingId, userId }) => {
  if (!bookingId || !isValidId(bookingId)) return null;
  const booking = await Booking.findOne({ _id: bookingId, user: userId })
    .populate('field', 'fieldName type address pricingRules status')
    .populate('voucherId', 'code discountType discountValue discountPercent endDate')
    .lean();
  if (!booking) return null;

  return {
    id: booking._id,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    totalPrice: formatCurrency(booking.totalPrice),
    finalAmount: formatCurrency(booking.finalAmount || booking.totalPrice),
    voucherCode: booking.voucherCode || booking.voucherId?.code || '',
    field: booking.field ? serializeField(booking.field) : null
  };
};

const getPolicyContext = async () => {
  const policies = await Policy.find({}).select('type title content updatedAt').lean();
  return policies.map((policy) => ({
    type: policy.type,
    title: policy.title,
    contentPreview: String(policy.content || '').replace(/<[^>]+>/g, ' ').slice(0, 1200),
    updatedAt: policy.updatedAt
  }));
};

const buildArenaContext = async ({ user, message, bookingId }) => {
  const userId = toId(user);
  const normalized = normalizeText(message);
  const wantsAvailability = /(trong|con trong|gio trong|lich trong|toi nay|hom nay|ngay mai)/.test(normalized);
  const wantsVoucher = /(voucher|ma giam|khuyen mai|giam gia)/.test(normalized);
  const wantsPolicy = /(huy|chinh sach|hoan tien|dieu khoan|thanh toan)/.test(normalized);

  const [fields, booking, availability, vouchers, policies] = await Promise.all([
    getRelevantFields({ message }),
    getBookingContext({ bookingId, userId }),
    wantsAvailability ? getAvailabilityContext({ message }) : Promise.resolve(null),
    wantsVoucher ? getUserVoucherContext(userId) : Promise.resolve(null),
    wantsPolicy ? getPolicyContext() : Promise.resolve([])
  ]);

  return {
    currentDate: getVietnamDateString(),
    user: {
      id: userId,
      fullName: user?.fullName || user?.name || '',
      email: user?.email || ''
    },
    relevantFields: fields,
    relatedBooking: booking,
    availability,
    vouchers,
    policies
  };
};

const buildPrompt = ({ user, message, history, context }) => {
  const historyText = (history || []).slice(-MAX_HISTORY).map((item) => (
    `${item.sender === 'user' ? 'Khách' : 'AI'}: ${item.message}`
  )).join('\n');

  return `${SYSTEM_PROMPT}

${AI_OPERATION_LIMITS}

THÔNG TIN KHÁCH HÀNG:
${JSON.stringify(context.user, null, 2)}

LỊCH SỬ GẦN ĐÂY:
${historyText || 'Chưa có lịch sử.'}

DỮ LIỆU HỆ THỐNG ARENAHUB:
${JSON.stringify(context, null, 2)}

CÂU HỎI HIỆN TẠI CỦA KHÁCH:
${message}

Hãy trả lời như nhân viên tư vấn ArenaHub và dùng tiếng Việt có dấu.`;
};

const getGeminiModelCandidates = () => {
  const configuredModel = String(process.env.GEMINI_MODEL || '').trim();
  return [
    configuredModel,
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ].filter(Boolean);
};

const generateWithFallbackModel = async ({ genAI, prompt }) => {
  const candidates = getGeminiModelCandidates();
  let lastError = null;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return { result, modelName };
    } catch (error) {
      lastError = error;
      const message = String(error.message || '');
      const canTryNextModel = error.status === 404 || message.includes('404') || message.includes('not found');
      if (!canTryNextModel) throw error;
    }
  }

  throw lastError;
};

const generateAiReply = async ({ user, message, history, bookingId }) => {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('Chua cau hinh GEMINI_API_KEY.');
    error.statusCode = 500;
    throw error;
  }

  const context = await buildArenaContext({ user, message, bookingId });
  if (isBookingActionRequest(message)) {
    return {
      text: BOOKING_ACTION_REFUSAL,
      context,
      modelName: 'rule-based-refusal'
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const prompt = buildPrompt({ user, message, history, context });
  const { result, modelName } = await generateWithFallbackModel({ genAI, prompt });
  const response = await result.response;
  const text = String(response.text() || '').trim();

  return {
    text: text || 'Tôi chưa chắc về thông tin này, bạn có muốn chuyển sang admin không?',
    context,
    modelName
  };
};

module.exports = {
  buildArenaContext,
  generateAiReply
};
