const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

const userRoutes = require('./routes/userRoutes');
const userVoucherRoutes = require('./routes/userVoucherRoutes');
const adminFieldRoutes = require('./routes/adminFieldRoutes');
const userFieldRoutes = require('./routes/userFieldRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminBookingRoutes = require('./routes/adminBookingRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const policyRoutes = require('./routes/policyRoutes');
const contactRoutes = require('./routes/contactRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
const adminScheduleRoutes = require('./routes/adminScheduleRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const newsRoutes = require('./routes/newsRoutes');
const { setSocket } = require('./utils/socket');
connectDB();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

app.set('io', io);
setSocket(io);

io.on('connection', (socket) => {
  console.log(`Client ket noi: ${socket.id}`.cyan);
  const joinChatRooms = ({ userId, role } = {}) => {
    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === 'admin' || normalizedRole === 'super admin') {
      socket.join('admin');
      socket.join('admin_room');
    }
    if (userId) {
      socket.join(`user:${userId}`);
      socket.join(`user_${userId}`);
    }
  };

  socket.on('join', joinChatRooms);
  socket.on('join_chat', joinChatRooms);
  socket.on('typing_start', ({ conversationId, userId, role } = {}) => {
    const payload = { conversationId, userId, role };
    if (String(role || '').toLowerCase() === 'admin') {
      if (userId) socket.to(`user_${userId}`).to(`user:${userId}`).emit('typing_start', payload);
    } else {
      socket.to('admin_room').to('admin').emit('typing_start', payload);
    }
  });
  socket.on('typing_stop', ({ conversationId, userId, role } = {}) => {
    const payload = { conversationId, userId, role };
    if (String(role || '').toLowerCase() === 'admin') {
      if (userId) socket.to(`user_${userId}`).to(`user:${userId}`).emit('typing_stop', payload);
    } else {
      socket.to('admin_room').to('admin').emit('typing_stop', payload);
    }
  });
  socket.on('disconnect', () => console.log('Client ngat ket noi'.gray));
});

app.get('/', (req, res) => {
  res.send('ArenaHub API dang van hanh on dinh...');
});

app.use('/api/users', userRoutes);
app.use('/api/user', userVoucherRoutes);
app.use('/api/admin/fields', adminFieldRoutes);
app.use('/api/fields', userFieldRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/vouchers', voucherRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/admin', adminScheduleRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/admin/banners', bannerRoutes);
app.use('/api/news', newsRoutes);

app.use((err, req, res, next) => {
  console.error('Loi Server: '.red, err.stack);
  res.status(500).json({ message: 'Loi he thong noi bo!', error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server ArenaHub chay tai port ${PORT}`.magenta.bold);
});

process.on('unhandledRejection', (err) => {
  console.error(`Loi he thong nghiem trong: ${err.message}`.red.bold);
});
