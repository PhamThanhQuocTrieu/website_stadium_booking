const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Đã sửa đường dẫn thành ./models/User
const User = require('./models/User'); 
require('dotenv').config();

const seedAdmin = async () => {
    try {
        // Kết nối với URI từ file .env
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Đã kết nối MongoDB");

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = {
            fullName: "Admin Quản trị",
            email: "admin@arenahub.com",
            password: hashedPassword,
            role: "Super Admin",
            isActive: true
        };

        const existingAdmin = await User.findOne({ email: admin.email });
        if (existingAdmin) {
            console.log("⚠️ Tài khoản Admin đã tồn tại!");
        } else {
            await User.create(admin);
            console.log("🚀 Đã tạo lại tài khoản Admin thành công!");
            console.log("Email: admin@arenahub.com | Password: admin123");
        }

        process.exit();
    } catch (error) {
        console.error("❌ Lỗi:", error);
        process.exit(1);
    }
};

seedAdmin();