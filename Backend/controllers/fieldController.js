// File: Backend/controllers/fieldController.js
const Field = require('../models/Field');
const PricingRule = require('../models/PricingRule');
const mongoose = require('mongoose');

// Hàm bổ trợ làm sạch chuỗi JSON nhiễm rác từ trình duyệt và multipart/form-data
const parsePricingRulesSafely = (rawRules) => {
  if (!rawRules) return [];
  if (Array.isArray(rawRules)) return rawRules;
  
  try {
    if (typeof rawRules === 'string') {
      // 🌟 LÁ CHẮN BẢO VỆ NÂNG CAO: Loại bỏ các dấu nháy đơn, ký tự xuống dòng \n và rác do form-data bọc sai cấu trúc
      let cleanStr = rawRules.trim();
      if (cleanStr.startsWith("'") && cleanStr.endsWith("'")) {
        cleanStr = cleanStr.slice(1, -1);
      }
      cleanStr = cleanStr.replace(/\\n/g, '').replace(/\n/g, '');
      return JSON.parse(cleanStr);
    }
  } catch (error) {
    console.error("Lỗi parse dữ liệu ma trận giá, thử dùng Regex bóc tách thủ công:", error);
    
    // Phương án dự phòng cuối cùng: Dùng Regex quét bóc tách nếu chuỗi JSON bị hỏng nặng
    try {
      const matches = [...rawRules.matchAll(/\{([^}]+)\}/g)];
      return matches.map(m => {
        const itemStr = m[0].replace(/'/g, '"'); // Đổi nháy đơn thành nháy kép hợp lệ
        return JSON.parse(itemStr);
      });
    } catch (innerError) {
      console.error("Bóc tách Regex thất bại:", innerError);
    }
  }
  return [];
};

// =========================================================================
// 1. API: KHỞI TẠO TÀI NGUYÊN SÂN MỚI (POST /api/admin/fields)
// =========================================================================
exports.createField = async (req, res) => {
  try {
    const { pricingRules, ...fieldData } = req.body;
    
    // Giải mã mảng quy tắc từ chuỗi thô Front-end truyền xuống
    const ruleObjects = parsePricingRulesSafely(pricingRules);
    let ruleIds = [];

    if (ruleObjects && Array.isArray(ruleObjects)) {
      // Lưu độc lập từng khung giờ vào bảng PricingRule để thu thập ID
      const rulePromises = ruleObjects.map(async (rule) => {
        if (!rule || !rule.ruleName) return null;
        
        const newRule = await PricingRule.create({
          ruleName: rule.ruleName,
          startTime: rule.startTime || '05:00',
          endTime: rule.endTime || '22:00',
          price: Number(rule.price) || 0,
          dayType: rule.dayType || 'Weekday',
          isPeakHour: Boolean(rule.isPeakHour)
        });
        return newRule._id;
      });
      
      const resolvedIds = await Promise.all(rulePromises);
      ruleIds = resolvedIds.filter(id => id !== null);
    }

    // Đóng gói payload sạch chứa mảng ObjectId liên kết hợp lệ
    const finalNewFieldData = {
      ...fieldData,
      pricingRules: ruleIds
    };

    const createdField = await Field.create(finalNewFieldData);
    const populatedField = await Field.findById(createdField._id).populate('pricingRules');

    if (req.app && req.app.get('io')) {
      req.app.get('io').emit('field_updated', populatedField);
    }

    return res.status(201).json(populatedField);
    
  } catch (error) {
    console.error("Lỗi crash tại createField:", error);
    return res.status(400).json({ message: 'Lỗi khởi tạo tài nguyên bãi sân!', error: error.message });
  }
};

// =========================================================================
// 2. API: CẬP NHẬT SÂN BÃI & MA TRẬN GIÁ LINH HOẠT (PUT /api/admin/fields/:id)
// =========================================================================
exports.updateField = async (req, res) => {
  try {
    const fieldId = req.params.id;
    let { pricingRules, ...otherFieldData } = req.body;

    const ruleObjects = parsePricingRulesSafely(pricingRules);
    let updatedRuleIds = [];

    if (ruleObjects && Array.isArray(ruleObjects)) {
      const rulePromises = ruleObjects.map(async (rule) => {
        if (!rule || !rule.ruleName) return null;

        // Nếu bản ghi giá đã tồn tại ID MongoDB hợp lệ ➜ Cập nhật trực tiếp
        if (rule._id && mongoose.Types.ObjectId.isValid(rule._id)) {
          await PricingRule.findByIdAndUpdate(rule._id, {
            ruleName: rule.ruleName,
            startTime: rule.startTime,
            endTime: rule.endTime,
            price: Number(rule.price) || 0,
            dayType: rule.dayType || 'Weekday',
            isPeakHour: Boolean(rule.isPeakHour)
          });
          return rule._id;
        } else {
          // Khung giờ mới bấm thêm từ Frontend ➜ Tạo mới độc lập
          const newRule = await PricingRule.create({
            ruleName: rule.ruleName,
            startTime: rule.startTime,
            endTime: rule.endTime,
            price: Number(rule.price) || 0,
            dayType: rule.dayType || 'Weekday',
            isPeakHour: Boolean(rule.isPeakHour)
          });
          return newRule._id;
        }
      });

      const resolvedIds = await Promise.all(rulePromises);
      updatedRuleIds = resolvedIds.filter(id => id !== null);
    }

    const finalDataToUpdate = {
      ...otherFieldData,
      pricingRules: updatedRuleIds
    };

    const updatedField = await Field.findByIdAndUpdate(
      fieldId, 
      finalDataToUpdate, 
      { new: true, runValidators: true }
    ).populate('pricingRules');

    if (!updatedField) return res.status(404).json({ message: 'Không tìm thấy bãi sân yêu cầu!' });
    if (req.app && req.app.get('io')) req.app.get('io').emit('field_updated', updatedField);

    return res.status(200).json(updatedField);

  } catch (error) {
    console.error("Lỗi crash tại updateField:", error);
    return res.status(400).json({ message: 'Lỗi cấu trúc ma trận giá chỉnh sửa!', error: error.message });
  }
};

// =========================================================================
// 3. API: LẤY DANH SÁCH TẤT CẢ CÁC SÂN (GET /api/admin/fields)
// =========================================================================
exports.getAllFields = async (req, res) => {
  try {
    const fields = await Field.find().populate('pricingRules').sort({ createdAt: -1 });
    return res.status(200).json(fields);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách tài nguyên!', error: error.message });
  }
};

// =========================================================================
// 4. API: XÓA SÂN VÀ CÁC QUY TẮC GIÁ LIÊN QUAN (DELETE /api/admin/fields/:id)
// =========================================================================
exports.deleteField = async (req, res) => {
  try {
    const fieldId = req.params.id;
    const field = await Field.findById(fieldId);

    if (!field) return res.status(404).json({ message: 'Sân bãi không tồn tại!' });

    if (field.pricingRules && field.pricingRules.length > 0) {
      await PricingRule.deleteMany({ _id: { $in: field.pricingRules } });
    }

    await Field.findByIdAndDelete(fieldId);
    if (req.app && req.app.get('io')) req.app.get('io').emit('field_updated', { _id: fieldId, deleted: true });

    return res.status(200).json({ message: 'Đã giải phóng tài nguyên bãi sân bãi thành công!' });
  } catch (error) {
    return res.status(500).json({ message: 'Xóa tài nguyên bãi sân thất bại!', error: error.message });
  }
};