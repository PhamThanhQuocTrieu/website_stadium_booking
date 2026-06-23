const Field = require('../models/Field');
const mongoose = require('mongoose');

// Hàm bổ trợ làm sạch chuỗi JSON
const parsePricingRulesSafely = (rawRules) => {
    if (!rawRules) return [];
    if (Array.isArray(rawRules)) return rawRules;
    try {
        if (typeof rawRules === 'string') {
            return JSON.parse(rawRules);
        }
    } catch (e) { return []; }
    return [];
};

// [GET] Lấy toàn bộ sân
exports.adminGetAllFields = async (req, res) => {
    try {
        // Không cần .populate vì pricingRules đã nằm trực tiếp trong Field
        const fields = await Field.find().sort({ createdAt: -1 });
        res.status(200).json(fields);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách tài nguyên!" });
    }
};

// [GET] Lấy 1 sân theo ID
exports.adminGetFieldById = async (req, res) => {
    try {
        const field = await Field.findById(req.params.id);
        if (!field) return res.status(404).json({ message: "Không tìm thấy sân!" });
        res.status(200).json(field);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy thông tin sân!" });
    }
};

// [POST] Thêm sân
exports.adminCreateField = async (req, res) => {
    try {
        const { pricingRules, ...fieldData } = req.body;
        const ruleObjects = parsePricingRulesSafely(pricingRules);
        
        // Lưu trực tiếp ruleObjects vào Field
        const newField = await Field.create({ 
            ...fieldData, 
            pricingRules: ruleObjects 
        });

        if (req.app.get('io')) req.app.get('io').emit('field_updated', newField);
        res.status(201).json(newField);
    } catch (error) {
        res.status(400).json({ message: "Lỗi tạo sân: " + error.message });
    }
};

// [PUT] Cập nhật sân
exports.adminUpdateField = async (req, res) => {
    try {
        const { pricingRules, ...fieldData } = req.body;
        const ruleObjects = parsePricingRulesSafely(pricingRules);
        
        const updatedField = await Field.findByIdAndUpdate(
            req.params.id, 
            { ...fieldData, pricingRules: ruleObjects }, 
            { new: true, runValidators: true }
        );

        if (!updatedField) return res.status(404).json({ message: "Sân không tồn tại" });
        
        if (req.app.get('io')) req.app.get('io').emit('field_updated', updatedField);
        res.status(200).json(updatedField);
    } catch (error) {
        res.status(400).json({ message: "Lỗi cập nhật sân: " + error.message });
    }
};

// [DELETE] Xóa sân
exports.adminDeleteField = async (req, res) => {
    try {
        const field = await Field.findByIdAndDelete(req.params.id);
        if (!field) return res.status(404).json({ message: "Sân không tồn tại" });
        
        if (req.app.get('io')) req.app.get('io').emit('field_updated', { _id: req.params.id, deleted: true });
        res.status(200).json({ message: "Xóa thành công" });
    } catch (error) {
        res.status(500).json({ message: "Xóa thất bại", error: error.message });
    }
};
exports.adminToggleFieldMaintenance = async (req, res) => {
    try {
        const field = await Field.findById(req.params.id);
        if (!field) return res.status(404).json({ message: "San khong ton tai" });

        const nextStatus = req.body?.maintenance === undefined
            ? (field.status === 'Maintenance' ? 'Active' : 'Maintenance')
            : (req.body.maintenance ? 'Maintenance' : 'Active');

        field.status = nextStatus;
        await field.save();

        if (req.app.get('io')) req.app.get('io').emit('field_updated', field);
        res.status(200).json(field);
    } catch (error) {
        res.status(400).json({ message: "Loi cap nhat trang thai san: " + error.message });
    }
};
