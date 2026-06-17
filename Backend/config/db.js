const mongoose = require('mongoose');
const ensureBookingIndexes = require('../utils/ensureBookingIndexes');
const ensureDefaultPolicies = require('../utils/ensureDefaultPolicies');
const { ensureWelcomeVoucher } = require('../services/voucherService');

const connectDB = async () => {
  try {
    // Với Mongoose 6+ và 7+, bạn không cần các option như useNewUrlParser hay useUnifiedTopology nữa
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Chỉ nên để 5s cho Local, nếu 5s không kết nối được là do lỗi config rồi
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.underline);
    await ensureBookingIndexes();
    await ensureDefaultPolicies();
    await ensureWelcomeVoucher();
  } catch (error) {
    console.error(`❌ Lỗi kết nối Database: ${error.message}`.red.bold);
    // Lời khuyên: Ở môi trường Local, nếu lỗi kết nối DB thì nên dừng để kiểm tra lại Compass
    process.exit(1); 
  }
};

module.exports = connectDB;
