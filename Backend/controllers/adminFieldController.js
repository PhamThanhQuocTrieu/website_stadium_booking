const Field = require('../models/Field');

/**
 * [GET] Lấy tất cả sân
 */
exports.adminGetAllFields = async (req, res) => {
  try {
    const fields = await Field.find().sort({ createdAt: -1 });
    res.json(fields);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách" });
  }
};

/**
 * [POST] Thêm sân mới (Đã xử lý JSON.parse cho pricingRules)
 */
exports.adminCreateField = async (req, res) => {
  try {
    const { pricingRules, ...fieldData } = req.body;
    
    // Parse JSON string từ Frontend về dạng mảng object
    const parsedPricing = pricingRules ? JSON.parse(pricingRules) : [];

    const newField = new Field({
      ...fieldData,
      pricingRules: parsedPricing
    });
    
    await newField.save();

    // Phát tín hiệu Realtime
    req.app.get('io').emit('field_updated', { 
      action: 'create', 
      message: 'Sân mới đã được thêm vào hệ thống',
      data: newField 
    });

    res.status(201).json(newField);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * [PUT] Cập nhật sân (Xử lý đồng bộ pricingRules)
 */
exports.adminUpdateField = async (req, res) => {
  try {
    const { pricingRules, ...fieldData } = req.body;
    const parsedPricing = pricingRules ? JSON.parse(pricingRules) : [];

    const updated = await Field.findByIdAndUpdate(
      req.params.id, 
      { ...fieldData, pricingRules: parsedPricing }, 
      { new: true }
    );
    
    if (updated) {
      req.app.get('io').emit('field_updated', { 
        action: 'update', 
        message: `Sân ${updated.fieldName} vừa được cập nhật`,
        data: updated 
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Cập nhật thất bại: " + error.message });
  }
};

/**
 * [DELETE] Xóa sân
 */
exports.adminDeleteField = async (req, res) => {
  try {
    const deletedField = await Field.findByIdAndDelete(req.params.id);
    
    if (deletedField) {
      req.app.get('io').emit('field_updated', { 
        action: 'delete', 
        id: req.params.id 
      });
    }

    res.json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(400).json({ message: "Xóa thất bại" });
  }
};