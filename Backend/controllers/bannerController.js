const Banner = require('../models/Banner');

const allowedPositions = ['home_hero', 'home_promo'];

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const buildActiveDateQuery = (now = new Date()) => ({
  isActive: true,
  $and: [
    { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
    { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
  ]
});

const normalizeBannerPayload = (body) => {
  const payload = {
    title: String(body.title || '').trim(),
    subtitle: String(body.subtitle || '').trim(),
    description: String(body.description || '').trim(),
    image: String(body.image || '').trim(),
    buttonText: String(body.buttonText || '').trim(),
    buttonLink: String(body.buttonLink || '').trim(),
    voucherCode: String(body.voucherCode || '').trim().toUpperCase(),
    position: body.position || 'home_hero',
    order: Number(body.order || 0),
    isActive: normalizeBoolean(body.isActive, true),
    startDate: normalizeDate(body.startDate),
    endDate: normalizeDate(body.endDate)
  };

  if (payload.startDate === undefined || payload.endDate === undefined) {
    const error = new Error('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.');
    error.statusCode = 400;
    throw error;
  }

  return payload;
};

const validateBannerPayload = (payload) => {
  if (!payload.title) {
    return 'Vui lòng nhập tiêu đề banner.';
  }
  if (!payload.image) {
    return 'Vui lòng chọn ảnh banner.';
  }
  if (!allowedPositions.includes(payload.position)) {
    return 'Vị trí hiển thị banner không hợp lệ.';
  }
  if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
    return 'Ngày bắt đầu không được lớn hơn ngày kết thúc.';
  }
  return '';
};

const emitBannerUpdated = (req, payload) => {
  const io = req.app.get('io');
  if (io) io.emit('banner_updated', payload);
};

exports.getAdminBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: 1 });
    res.json({ message: 'Lấy danh sách banner thành công.', banners });
  } catch (err) {
    res.status(500).json({ message: 'Không thể lấy danh sách banner.', error: err.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const payload = normalizeBannerPayload(req.body);
    const validationMessage = validateBannerPayload(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const banner = await Banner.create(payload);
    emitBannerUpdated(req, { action: 'created', banner });
    res.status(201).json({ message: 'Tạo banner thành công.', banner });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'Không thể tạo banner.' });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const payload = normalizeBannerPayload(req.body);
    const validationMessage = validateBannerPayload(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const banner = await Banner.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!banner) return res.status(404).json({ message: 'Không tìm thấy banner.' });

    emitBannerUpdated(req, { action: 'updated', banner });
    res.json({ message: 'Cập nhật banner thành công.', banner });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'Không thể cập nhật banner.' });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Không tìm thấy banner.' });

    emitBannerUpdated(req, { action: 'deleted', bannerId: req.params.id });
    res.json({ message: 'Đã xóa banner thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Không thể xóa banner.', error: err.message });
  }
};

exports.toggleBannerActive = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Không tìm thấy banner.' });

    banner.isActive = !banner.isActive;
    await banner.save();

    emitBannerUpdated(req, { action: 'toggle-active', banner });
    res.json({
      message: banner.isActive ? 'Banner đã được bật hiển thị.' : 'Banner đã được ẩn.',
      banner
    });
  } catch (err) {
    res.status(400).json({ message: 'Không thể đổi trạng thái banner.', error: err.message });
  }
};

exports.getHomeBanners = async (req, res) => {
  try {
    const banners = await Banner.find(buildActiveDateQuery()).sort({ order: 1, createdAt: 1 });
    res.json({ message: 'Lấy banner trang chủ thành công.', banners });
  } catch (err) {
    res.status(500).json({ message: 'Không thể lấy banner trang chủ.', error: err.message });
  }
};
