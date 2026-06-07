const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const colors = require('colors');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

const userRoutes = require('./routes/userRoutes');
const adminFieldRoutes = require('./routes/adminFieldRoutes');
const userFieldRoutes = require('./routes/userFieldRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`Client ket noi: ${socket.id}`.cyan);
  socket.on('disconnect', () => console.log('Client ngat ket noi'.gray));
});

app.get('/', (req, res) => {
  res.send('ArenaHub API dang van hanh on dinh...');
});

app.use('/api/users', userRoutes);
app.use('/api/admin/fields', adminFieldRoutes);
app.use('/api/fields', userFieldRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/vouchers', voucherRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);

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
