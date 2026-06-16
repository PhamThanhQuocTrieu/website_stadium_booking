const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const { CONTACT_CATEGORIES, CONTACT_STATUSES } = require('../models/Contact');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vietnamPhoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

const normalizeText = (value) => String(value || '').trim();
const normalizePhone = (value) => normalizeText(value).replace(/[\s.-]/g, '');

const validateContactPayload = (payload) => {
  const fullName = normalizeText(payload.fullName);
  const email = normalizeText(payload.email).toLowerCase();
  const phone = normalizePhone(payload.phone);
  const category = normalizeText(payload.category);
  const subject = normalizeText(payload.subject);
  const message = normalizeText(payload.message);

  if (!fullName) return { message: 'Họ và tên không được để trống.' };
  if (!emailRegex.test(email)) return { message: 'Email không đúng định dạng.' };
  if (!vietnamPhoneRegex.test(phone)) return { message: 'Số điện thoại Việt Nam không hợp lệ.' };
  if (!CONTACT_CATEGORIES.includes(category)) return { message: 'Loại yêu cầu không hợp lệ.' };
  if (!subject) return { message: 'Chủ đề không được để trống.' };
  if (message.length < 10) return { message: 'Nội dung liên hệ phải có tối thiểu 10 ký tự.' };

  return {
    data: {
      fullName,
      email,
      phone,
      category,
      subject,
      message
    }
  };
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createContact = async (req, res) => {
  try {
    const validation = validateContactPayload(req.body);
    if (validation.message) {
      return res.status(400).json({ message: validation.message });
    }

    const contact = await Contact.create(validation.data);

    res.status(201).json({
      message: 'Gửi liên hệ thành công. Chúng tôi sẽ phản hồi bạn sớm nhất.',
      contact
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể gửi liên hệ.', error: error.message });
  }
};

exports.getContacts = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status);
    const category = normalizeText(req.query.category);

    const filter = {};
    if (status && CONTACT_STATUSES.includes(status)) filter.status = status;
    if (category && CONTACT_CATEGORIES.includes(category)) filter.category = category;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { subject: regex }
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Contact.countDocuments(filter)
    ]);

    res.json({
      contacts,
      total,
      page,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải danh sách liên hệ.', error: error.message });
  }
};

exports.getContactById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã liên hệ không hợp lệ.' });
    }

    const contact = await Contact.findById(req.params.id).lean();
    if (!contact) {
      return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải chi tiết liên hệ.', error: error.message });
  }
};

exports.updateContactStatus = async (req, res) => {
  try {
    const status = normalizeText(req.body.status);
    if (!CONTACT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã liên hệ không hợp lệ.' });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật trạng thái liên hệ.', error: error.message });
  }
};

exports.replyContact = async (req, res) => {
  try {
    const adminReply = normalizeText(req.body.adminReply);
    if (!adminReply) {
      return res.status(400).json({ message: 'Nội dung phản hồi không được để trống.' });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã liên hệ không hợp lệ.' });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      {
        adminReply,
        status: 'replied',
        repliedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: 'Không thể gửi phản hồi liên hệ.', error: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã liên hệ không hợp lệ.' });
    }

    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Không tìm thấy liên hệ.' });
    }

    res.json({ message: 'Đã xóa liên hệ thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa liên hệ.', error: error.message });
  }
};
