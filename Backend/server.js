// File: Backend/server.js
const express = require('express');
const http = require('http'); 
const { Server } = require('socket.io'); 
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');
const connectDB = require('./config/db');

// IMPORT CÁC ĐƯỜNG DẪN ĐỊNH TUYẾN (ROUTES)
const userRoutes = require('./routes/userRoutes');
const adminFieldRoutes = require('./routes/adminFieldRoutes');
const userFieldRoutes = require('./routes/userFieldRoutes');
const bookingRoutes = require('./routes/bookingRoutes'); 
const voucherRoutes = require('./routes/voucherRoutes');
const serviceRoutes = require('./routes/serviceRoutes'); // 🌟 IMPORT ROUTE DỊCH VỤ MỚI

// 1. Cấu hình biến môi trường
dotenv.config();

// 2. Kết nối Database
connectDB();

const app = express();

// 3. CẤU HÌNH MIDDLEWARE
app.use(cors({
  origin: "http://localhost:5173", 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // 🌟 Đã thêm PATCH cho việc cập nhật status
  allowedHeaders: ["Content-Type", "Authorization"]
})); 

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 4. CẤU HÌNH HTTP SERVER & SOCKET.IO
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`⚡ Client kết nối: ${socket.id}`.cyan);
  socket.on('disconnect', () => console.log('❌ Client ngắt kết nối'.gray));
});

// 5. ĐỊNH NGHĨA CÁC ENDPOINT
app.get('/', (req, res) => {
  res.send('ArenaHub API đang vận hành ổn định...');
});

// PHÂN TÁCH ROUTES
app.use('/api/users', userRoutes);
app.use('/api/admin/fields', adminFieldRoutes); 
app.use('/api/fields', userFieldRoutes);       
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/vouchers', voucherRoutes);
app.use('/api/services', serviceRoutes); // 🌟 ĐĂNG KÝ ROUTE DỊCH VỤ

// 6. MIDDLEWARE BẮT LỖI TẬP TRUNG
app.use((err, req, res, next) => {
  console.error("❌ Lỗi Server: ".red, err.stack);
  res.status(500).json({ message: "Lỗi hệ thống nội bộ!", error: err.message });
});

// 7. KHỞI ĐỘNG MÁY CHỦ
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ArenaHub chạy tại port ${PORT}`.magenta.bold);
});

// 8. BẮT LỖI NGHIÊM TRỌNG
process.on('unhandledRejection', (err) => {
  console.error(`❌ Lỗi hệ thống nghiêm trọng: ${err.message}`.red.bold);
});