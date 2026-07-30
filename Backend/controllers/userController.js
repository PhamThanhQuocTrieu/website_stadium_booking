const User = require('../models/User');
const Otp = require('../models/Otp');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const transporter = require('../config/mail');
const { assignNewUserVouchers, ensureWelcomeVoucherForEligibleUser } = require('../services/voucherService');

const ADMIN_ROLES = ['admin', 'super admin'];
const isAdminRole = (role = '') => ADMIN_ROLES.includes(String(role).toLowerCase());
const getRequestUserId = (req) => req.user?.id || req.user?._id;

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

const RESET_OTP_SUCCESS_MESSAGE = 'Nếu email tồn tại trong hệ thống, mã OTP sẽ được gửi đến email của bạn.';

const normalizeEmail = (email = '') => email.toLowerCase().trim();

const getOtpExpireMinutes = () => {
  const minutes = Number(process.env.OTP_EXPIRE_MINUTES);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 1;
};

const createResetOtpEmail = ({ otp, expireMinutes }) => `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e5eaf1;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
        <div style="padding:26px 30px;background:#0f5132;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:.5px;">ArenaHub</div>
          <div style="margin-top:6px;color:#d1fae5;font-size:14px;">Đặt lại mật khẩu tài khoản của bạn</div>
        </div>
        <div style="padding:30px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Chào bạn,</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
            ArenaHub đã nhận được yêu cầu đặt lại mật khẩu. Vui lòng nhập mã OTP bên dưới để tiếp tục.
          </p>
          <div style="margin:24px 0;padding:24px;border-radius:14px;background:#ecfdf5;border:1px solid #bbf7d0;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;">Mã OTP của bạn</div>
            <div style="margin-top:10px;font-size:38px;font-weight:900;letter-spacing:10px;color:#0f172a;">${otp}</div>
          </div>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#475569;">
            Mã này có hiệu lực trong <strong>${expireMinutes} phút</strong>. Không chia sẻ mã OTP với bất kỳ ai.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu hiện tại của bạn vẫn được giữ nguyên.
          </p>
        </div>
      </div>
    </div>
  </div>
`;

const createChangePasswordOtpEmail = ({ otp, expireMinutes }) => `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e5eaf1;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
        <div style="padding:26px 30px;background:#0f5132;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:.5px;">ArenaHub</div>
          <div style="margin-top:6px;color:#d1fae5;font-size:14px;">Xác nhận đổi mật khẩu tài khoản</div>
        </div>
        <div style="padding:30px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Chào bạn,</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
            Vui lòng nhập mã OTP bên dưới trên trang thông tin cá nhân để xác nhận đổi mật khẩu.
          </p>
          <div style="margin:24px 0;padding:24px;border-radius:14px;background:#ecfdf5;border:1px solid #bbf7d0;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.08em;">Mã OTP của bạn</div>
            <div style="margin-top:10px;font-size:38px;font-weight:900;letter-spacing:10px;color:#0f172a;">${otp}</div>
          </div>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
            Mã này có hiệu lực trong <strong>${expireMinutes} phút</strong>. Không chia sẻ mã OTP với bất kỳ ai.
          </p>
        </div>
      </div>
    </div>
  </div>
`;

const issueOtpForEmail = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await hashPassword(otp);
  const expireMinutes = getOtpExpireMinutes();
  const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);

  await Otp.deleteMany({ email });
  await Otp.create({ email, otpHash, expiresAt });

  return { otp, expireMinutes };
};

// [POST] Quên mật khẩu - gửi OTP
exports.forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email hợp lệ' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: RESET_OTP_SUCCESS_MESSAGE });
    }

    const { otp, expireMinutes } = await issueOtpForEmail(email);

    await transporter.sendMail({
      from: `"ArenaHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu ArenaHub',
      html: createResetOtpEmail({ otp, expireMinutes })
    });

    res.status(200).json({ message: RESET_OTP_SUCCESS_MESSAGE });
  } catch (error) {
    console.error('Reset password OTP email failed:', {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message
    });
    res.status(200).json({ message: RESET_OTP_SUCCESS_MESSAGE });
  }
};

// [POST] Gửi OTP đổi mật khẩu trong profile
exports.sendChangePasswordOtp = async (req, res) => {
  try {
    const { oldPassword } = req.body;
    const user = await User.findById(getRequestUserId(req));

    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    if (!oldPassword || !(await user.matchPassword(oldPassword))) {
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác' });
    }

    const email = normalizeEmail(user.email);
    const { otp, expireMinutes } = await issueOtpForEmail(email);

    await transporter.sendMail({
      from: `"ArenaHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Mã OTP đổi mật khẩu ArenaHub',
      html: createChangePasswordOtpEmail({ otp, expireMinutes })
    });

    res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn' });
  } catch (error) {
    console.error('Change password OTP email failed:', {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message
    });
    res.status(500).json({ message: 'Không thể gửi OTP, vui lòng thử lại sau.' });
  }
};

// [POST] Xác thực OTP đặt lại mật khẩu
exports.verifyResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    const resetOtp = await Otp.findOne({ email });
    if (!resetOtp) {
      return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
    }

    if (resetOtp.expiresAt.getTime() < Date.now()) {
      await Otp.deleteOne({ _id: resetOtp._id });
      return res.status(400).json({ message: 'OTP đã hết hạn, vui lòng gửi lại mã mới' });
    }

    if (resetOtp.attempts >= 5) {
      await Otp.deleteOne({ _id: resetOtp._id });
      return res.status(429).json({ message: 'Bạn đã nhập sai OTP quá nhiều lần, vui lòng gửi lại mã mới' });
    }

    const isMatch = await bcrypt.compare(otp, resetOtp.otpHash);
    if (!isMatch) {
      resetOtp.attempts += 1;
      await resetOtp.save();
      return res.status(400).json({ message: 'OTP không đúng, vui lòng kiểm tra lại' });
    }

    resetOtp.verified = true;
    await resetOtp.save();

    res.status(200).json({ message: 'Xác thực OTP thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi xác thực OTP.' });
  }
};

// [POST] Đặt lại mật khẩu
exports.resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không trùng khớp' });
    }

    const resetOtp = await Otp.findOne({ email, verified: true });
    if (!resetOtp) {
      return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
    }

    if (resetOtp.expiresAt.getTime() < Date.now()) {
      await Otp.deleteOne({ _id: resetOtp._id });
      return res.status(400).json({ message: 'OTP đã hết hạn, vui lòng gửi lại mã mới' });
    }

    const isMatch = await bcrypt.compare(otp, resetOtp.otpHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'OTP không đúng, vui lòng kiểm tra lại' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await Otp.deleteOne({ _id: resetOtp._id });
      return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
    }

    user.password = await hashPassword(newPassword);
    await user.save();
    await Otp.deleteOne({ _id: resetOtp._id });

    res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu.' });
  }
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
    const { oldPassword, newPassword, confirmPassword, passwordOtp, ...updateData } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User không tồn tại' });

    const requesterId = getRequestUserId(req);
    const isSelfUpdate = requesterId && String(requesterId) === String(user._id);
    const requesterIsAdmin = isAdminRole(req.user?.role);

    if (!isSelfUpdate && !requesterIsAdmin) {
      return res.status(403).json({ message: 'Ban khong co quyen cap nhat tai khoan nay' });
    }

    if (!isSelfUpdate && isAdminRole(user.role)) {
      return res.status(403).json({ message: 'Khong the thao tac voi tai khoan admin' });
    }

    if (newPassword) {
      if (!oldPassword || !(await user.matchPassword(oldPassword))) {
        return res.status(400).json({ message: 'Mật khẩu cũ không chính xác' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Mật khẩu xác nhận không trùng khớp' });
      }

      const cleanOtp = String(passwordOtp || '').trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ message: 'Vui lòng nhập mã OTP gồm 6 số để đổi mật khẩu' });
      }

      const changeOtp = await Otp.findOne({ email: normalizeEmail(user.email) });
      if (!changeOtp) {
        return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
      }

      if (changeOtp.expiresAt.getTime() < Date.now()) {
        await Otp.deleteOne({ _id: changeOtp._id });
        return res.status(400).json({ message: 'OTP đã hết hạn, vui lòng gửi lại mã mới' });
      }

      if (changeOtp.attempts >= 5) {
        await Otp.deleteOne({ _id: changeOtp._id });
        return res.status(429).json({ message: 'Bạn đã nhập sai OTP quá nhiều lần, vui lòng gửi lại mã mới' });
      }

      const isOtpMatch = await bcrypt.compare(cleanOtp, changeOtp.otpHash);
      if (!isOtpMatch) {
        changeOtp.attempts += 1;
        await changeOtp.save();
        return res.status(400).json({ message: 'OTP không đúng, vui lòng kiểm tra lại' });
      }

      user.password = await hashPassword(newPassword);
      await Otp.deleteOne({ _id: changeOtp._id });
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
    if (isAdminRole(role)) {
      return res.status(403).json({ message: 'Khong the tao tai khoan admin tai trang quan ly nguoi dung' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) return res.status(400).json({ message: 'Email đã tồn tại!' });

    const hashedPassword = await hashPassword(password);
    const user = await User.create({ fullName, email: email.toLowerCase().trim(), password: hashedPassword, role: role || 'user', phone });
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
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User khong ton tai' });
    if (isAdminRole(user.role)) {
      return res.status(403).json({ message: 'Khong the xoa tai khoan admin' });
    }

    await user.deleteOne();
    req.app.get('io').emit('userUpdated');
    res.status(200).json({ message: "Đã xóa" }); 
  } catch (err) { res.status(500).json({ message: err.message }); }
};
