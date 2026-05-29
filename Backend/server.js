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
const adminFieldRoutes = require('./routes/adminFieldRoutes'); // Dành cho Admin CRUD
const userFieldRoutes = require('./routes/userFieldRoutes');   // Dành cho Client xem/đặt sân
const bookingRoutes = require('./routes/bookingRoutes'); 

// 1. Cấu hình biến môi trường
dotenv.config();

// 2. Kết nối Database
connectDB();

const app = express();

// 3. CẤU HÌNH MIDDLEWARE
// Cấu hình CORS để cho phép Frontend gửi Token (credentials: true)
app.use(cors({
  origin: "http://localhost:5173", 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
})); 

// Tăng giới hạn payload để nhận dữ liệu lớn (ảnh/gallery/description từ ReactQuill)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 4. CẤU HÌNH HTTP SERVER & SOCKET.IO
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Gán 'io' để dùng trong Controllers qua req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`⚡ Client kết nối: ${socket.id}`.cyan);
  socket.on('disconnect', () => console.log('❌ Client ngắt kết nối'.gray));
});

// 5. ĐỊNH NGHĨA CÁC ENDPOINT
app.get('/', (req, res) => {
  res.send('ArenaHub API đang vận hành ổn định...');
});

// PHÂN TÁCH ROUTES RÕ RÀNG
// /api/admin/fields: Dành cho Admin quản lý sân (cần bảo mật)
// /api/fields: Dành cho User thường xem/đặt sân
app.use('/api/users', userRoutes);
app.use('/api/admin/fields', adminFieldRoutes); 
app.use('/api/fields', userFieldRoutes);       
app.use('/api/bookings', bookingRoutes);

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