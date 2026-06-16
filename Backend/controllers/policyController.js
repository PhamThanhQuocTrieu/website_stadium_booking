const Policy = require('../models/Policy');

const allowedTypes = ['terms', 'privacy'];

const isAllowedType = (type) => allowedTypes.includes(String(type || '').toLowerCase());

exports.getPublicPolicy = async (req, res) => {
  try {
    const type = String(req.params.type || '').toLowerCase();
    if (!isAllowedType(type)) {
      return res.status(400).json({ message: 'Loai chinh sach khong hop le.' });
    }

    const policy = await Policy.findOne({ type }).select('type title content updatedAt');
    if (!policy) {
      return res.status(404).json({ message: 'Khong tim thay chinh sach.' });
    }

    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: 'Khong the tai chinh sach.', error: error.message });
  }
};

exports.getAllPolicies = async (req, res) => {
  try {
    const policies = await Policy.find()
      .populate('updatedBy', 'fullName email')
      .lean();

    const order = { terms: 1, privacy: 2 };
    policies.sort((a, b) => (order[a.type] || 99) - (order[b.type] || 99));

    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: 'Khong the tai danh sach chinh sach.', error: error.message });
  }
};

exports.updatePolicy = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!String(title || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ message: 'Tieu de va noi dung khong duoc de trong.' });
    }

    const policy = await Policy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Khong tim thay chinh sach.' });
    }

    policy.title = String(title).trim();
    policy.content = content;
    if (req.user?.id || req.user?._id) {
      policy.updatedBy = req.user.id || req.user._id;
    }

    const updated = await policy.save();
    await updated.populate('updatedBy', 'fullName email');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Khong the cap nhat chinh sach.', error: error.message });
  }
};
