const News = require('../models/News');

const allowedStatuses = ['draft', 'published', 'hidden'];

const createSlug = (title = '') => {
  const normalized = String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `tin-tuc-${Date.now()}`;
};

const buildUniqueSlug = async (title, currentId = null) => {
  const baseSlug = createSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (await News.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  }

  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizePayload = (body) => {
  const status = allowedStatuses.includes(body.status) ? body.status : 'draft';

  return {
    title: String(body.title || '').trim(),
    summary: String(body.summary || '').trim(),
    content: String(body.content || '').trim(),
    thumbnail: String(body.thumbnail || '').trim(),
    category: body.category || 'Tin tức chung',
    tags: normalizeTags(body.tags),
    newsType: 'internal',
    status,
    isFeatured: Boolean(body.isFeatured)
  };
};

const validatePayload = (payload) => {
  if (!payload.title) return 'Vui lòng nhập tiêu đề tin tức.';
  if (!payload.content) return 'Vui lòng nhập nội dung tin tức.';

  return '';
};

const emitNewsUpdated = (req, payload) => {
  const io = req.app.get('io');
  if (io) io.emit('news_updated', payload);
};

exports.getAdminNews = async (req, res) => {
  try {
    const query = { newsType: 'internal' };

    const news = await News.find(query)
      .populate('author', 'fullName email')
      .sort({ createdAt: -1 });
    res.json({ message: 'Lấy danh sách tin tức thành công.', news });
  } catch (err) {
    res.status(500).json({ message: 'Không thể lấy danh sách tin tức.', error: err.message });
  }
};

exports.createNews = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    payload.slug = await buildUniqueSlug(payload.title);
    payload.author = req.user?._id || req.user?.id;
    if (payload.status === 'published') payload.publishedAt = new Date();

    const article = await News.create(payload);
    emitNewsUpdated(req, { action: 'created', article });
    res.status(201).json({ message: 'Tạo tin tức thành công.', article });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Không thể tạo tin tức.' });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Không tìm thấy tin tức.' });

    const payload = normalizePayload(req.body);
    const validationMessage = validatePayload(payload);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const wasPublished = article.status === 'published';
    Object.assign(article, payload);
    article.slug = await buildUniqueSlug(payload.title, article._id);
    if (payload.status === 'published' && (!wasPublished || !article.publishedAt)) {
      article.publishedAt = new Date();
    }
    if (payload.status !== 'published') article.publishedAt = null;

    await article.save();
    emitNewsUpdated(req, { action: 'updated', article });
    res.json({ message: 'Cập nhật tin tức thành công.', article });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Không thể cập nhật tin tức.' });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const article = await News.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ message: 'Không tìm thấy tin tức.' });

    emitNewsUpdated(req, { action: 'deleted', articleId: req.params.id });
    res.json({ message: 'Đã xóa tin tức thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Không thể xóa tin tức.', error: err.message });
  }
};

exports.getPublishedNews = async (req, res) => {
  try {
    const news = await News.find({ status: 'published', newsType: 'internal' })
      .select('-content')
      .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 });
    res.json({ message: 'Lấy danh sách tin tức thành công.', news });
  } catch (err) {
    res.status(500).json({ message: 'Không thể lấy danh sách tin tức.', error: err.message });
  }
};

exports.getPublishedNewsDetail = async (req, res) => {
  try {
    const identifiers = [{ slug: req.params.slugOrId }];
    if (/^[0-9a-fA-F]{24}$/.test(req.params.slugOrId)) {
      identifiers.push({ _id: req.params.slugOrId });
    }

    const article = await News.findOne({
      status: 'published',
      newsType: 'internal',
      $or: identifiers
    }).populate('author', 'fullName email');

    if (!article) return res.status(404).json({ message: 'Không tìm thấy tin tức đã xuất bản.' });

    article.views += 1;
    await article.save();

    res.json({ message: 'Lấy chi tiết tin tức thành công.', article });
  } catch (err) {
    res.status(500).json({ message: 'Không thể lấy chi tiết tin tức.', error: err.message });
  }
};
