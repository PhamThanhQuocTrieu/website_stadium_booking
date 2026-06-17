const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { assignNewUserVouchers, ensureWelcomeVoucherForEligibleUser } = require('../services/voucherService');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 🌟 FIX QUAN TRỌNG: Đảm bảo role được nhúng vào token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '2h' } // Nên tăng thời gian expire cho demo
  );
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// [POST] Google Login
exports.googleLogin = async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ email });
    let isNewUser = false;
    if (!user) {
      const role = (email === 'maulanhlun@gmail.com') ? 'admin' : 'user';
      const randomPassword = await hashPassword(Math.random().toString(36).slice(-8));
      
      user = await User.create({
        fullName: name,
        email,
        password: randomPassword,
        avatar: picture,
        role: role // Lưu role xuống DB
      });
      isNewUser = true;
    }

    if (isNewUser && user.role === 'user') {
      await assignNewUserVouchers(user, req.app.get('io'));
    } else if (!isNewUser && user.role === 'user') {
      await ensureWelcomeVoucherForEligibleUser(user._id, req.app.get('io'));
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      role: user.role, // Trả về role để Frontend lưu vào localStorage
      token: generateToken(user)
    });
  } catch (error) {
    res.status(401).json({ message: 'Xác thực Google thất bại: ' + error.message });
  }
};

// [POST] Đăng ký
exports.registerUser = async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body;
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) return res.status(400).json({ message: 'Email đã tồn tại.' });

    const hashedPassword = await hashPassword(password);
    const user = await User.create({ fullName, phone, email: email.toLowerCase().trim(), password: hashedPassword, role: 'user' });
    await assignNewUserVouchers(user, req.app.get('io'));

    req.app.get('io')?.emit('userUpdated');
    res.status(201).json({ _id: user._id, fullName: user.fullName, email: user.email, role: user.role, token: generateToken(user) });
  } catch (error) { res.status(500).json({ message: 'Lỗi server: ' + error.message }); }
};

// [POST] Đăng nhập
exports.loginUser = async (req, res) => {
  try {
    const { account, password } = req.body;
    const user = await User.findOne({ $or: [{ email: account.toLowerCase().trim() }, { phone: account }] });

    if (user && (await user.matchPassword(password))) {
      if (user.isActive === false) return res.status(403).json({ message: `Tài khoản đã bị khóa.` });
      
      if (String(user.role || '').toLowerCase() === 'user') {
        await ensureWelcomeVoucherForEligibleUser(user._id, req.app.get('io'));
      }

      res.json({ 
        _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone,
        avatar: user.avatar, dob: user.dob, role: user.role, token: generateToken(user) 
      });
    } else {
      res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu.' });
    }
  } catch (error) { res.status(500).json({ message: 'Lỗi máy chủ.' }); }
};

// [PUT] Cập nhật thông tin
exports.updateUser = async (req, res) => {
  try {
    const { oldPassword, newPassword, ...updateData } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User không tồn tại' });

    if (newPassword) {
      if (!oldPassword || !(await user.matchPassword(oldPassword))) {
        return res.status(400).json({ message: 'Mật khẩu cũ không chính xác' });
      }
      user.password = await hashPassword(newPassword);
    }

    Object.keys(updateData).forEach((key) => { if (key !== 'password' && key !== 'role') user[key] = updateData[key]; });
    const updatedUser = await user.save();
    
    req.app.get('io')?.emit('userUpdated');
    res.json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      dob: updatedUser.dob,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      token: generateToken(updatedUser)
    }); 
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// ... Các hàm createUser, getAllUsers, deleteUser giữ nguyên logic của bạn ...

// [POST] Thêm mới (Admin)
exports.createUser = async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) return res.status(400).json({ message: 'Email đã tồn tại!' });

    const hashedPassword = await hashPassword(password);
    const user = await User.create({ fullName, email, password: hashedPassword, role: role || 'user', phone });
    req.app.get('io').emit('userUpdated');
    res.status(201).json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// [GET] Lấy danh sách
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role, status } = req.query;
    let query = {};
    if (search) query.$or = [{ fullName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') query.isActive = (status === 'active');

    const users = await User.find(query).select('-password').limit(limit * 1).skip((page - 1) * limit).sort({ createdAt: -1 });
    const count = await User.countDocuments(query);
    res.status(200).json({ users, totalPages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// [DELETE] Xóa
exports.deleteUser = async (req, res) => {
  try { 
    await User.findByIdAndDelete(req.params.id); 
    req.app.get('io').emit('userUpdated');
    res.status(200).json({ message: "Đã xóa" }); 
  } catch (err) { res.status(500).json({ message: err.message }); }
};
