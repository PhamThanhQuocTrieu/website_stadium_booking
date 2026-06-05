const mongoose = require('mongoose');
const Service = require('../models/Service');

// 1. Lấy danh sách dịch vụ (Hỗ trợ tìm kiếm)
const getServices = async (req, res) => {
    try {
        const { search, fieldId } = req.query;
        // Tìm kiếm cả tên và mô tả bằng Regex không phân biệt hoa thường
        const query = search ? { 
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ] 
        } : {};

        if (fieldId) {
            if (!mongoose.Types.ObjectId.isValid(fieldId)) {
                return res.status(400).json({ message: "Mã sân không hợp lệ!" });
            }

            query.isActive = true;
            query.appliedFields = new mongoose.Types.ObjectId(fieldId);
        }
        
        const services = await Service.find(query).sort({ createdAt: -1 });
        res.status(200).json(services);
    } catch (err) { 
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message }); 
    }
};

// 2. Thêm mới dịch vụ
const createService = async (req, res) => {
    try {
        const { name, price, description, stock, image, appliedFields } = req.body;
        
        if (!name || price === undefined) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc (Tên, Giá)!" });
        }
        
        // Kiểm tra trùng lặp tên (không phân biệt hoa thường)
        const exists = await Service.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (exists) return res.status(400).json({ message: "Dịch vụ đã tồn tại!" });

        const service = await Service.create({ name, price, description, stock, image, appliedFields });
        
        // Phát sự kiện Real-time qua Socket.io
        const io = req.app.get('io');
        if (io) io.emit('serviceCreated', service);
        
        res.status(201).json(service);
    } catch (err) { 
        res.status(400).json({ message: err.message }); 
    }
};

// 3. Cập nhật dịch vụ
const updateService = async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(req.params.id, req.body, { 
            new: true, 
            runValidators: true 
        });
        
        if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ!" });
        
        const io = req.app.get('io');
        if (io) io.emit('serviceUpdated', service);
        
        res.json(service);
    } catch (err) { 
        res.status(400).json({ message: err.message }); 
    }
};

// 4. Xóa dịch vụ
const deleteService = async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ!" });
        
        const io = req.app.get('io');
        if (io) io.emit('serviceDeleted', req.params.id);
        
        res.json({ message: "Xóa dịch vụ thành công" });
    } catch (err) { 
        res.status(400).json({ message: err.message }); 
    }
};

// 5. Đổi trạng thái (Active/Inactive)
const toggleServiceStatus = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ!" });
        
        service.isActive = !service.isActive;
        await service.save();
        
        const io = req.app.get('io');
        if (io) io.emit('serviceStatusChanged', service);
        
        res.json(service);
    } catch (err) { 
        res.status(400).json({ message: err.message }); 
    }
};

module.exports = {
    getServices,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus
};
