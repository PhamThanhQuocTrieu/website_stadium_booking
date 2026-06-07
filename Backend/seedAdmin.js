const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = {
            fullName: 'Admin Quan tri',
            email: 'admin@arenahub.com',
            password: hashedPassword,
            role: 'admin',
            isActive: true
        };

        const existingAdmin = await User.findOne({ email: admin.email });
        if (existingAdmin) {
            existingAdmin.role = 'admin';
            existingAdmin.isActive = true;
            await existingAdmin.save();
            console.log('Admin account already exists. Role has been updated to admin.');
        } else {
            await User.create(admin);
            console.log('Admin account created successfully.');
            console.log('Email: admin@arenahub.com | Password: admin123');
        }

        process.exit();
    } catch (error) {
        console.error('Seed admin error:', error);
        process.exit(1);
    }
};

seedAdmin();
