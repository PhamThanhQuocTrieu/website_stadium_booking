const mongoose = require('mongoose');
const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const { generateAiReply } = require('../services/aiChatService');
const { emitToUser } = require('../utils/socket');

const getUserId = (req) => req.user?.id || req.user?._id;
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const getUserProfile = async (req) => {
  const userId = getUserId(req);
  const user = await User.findById(userId).select('fullName email phone role avatar').lean();
  return user || { _id: userId, ...req.user };
};

const getOrCreateSession = async ({ userId, bookingId }) => {
  const query = { userId };
  if (bookingId && isValidId(bookingId)) query.relatedBooking = bookingId;

  let session = await ChatSession.findOne(query).sort({ updatedAt: -1 });
  if (!session) {
    session = await ChatSession.create({
      userId,
      relatedBooking: bookingId && isValidId(bookingId) ? bookingId : null,
      messages: []
    });
  }
  return session;
};

const serializeSession = (session) => ({
  _id: session._id,
  userId: session.userId,
  relatedBooking: session.relatedBooking,
  messages: session.messages,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt
});

exports.sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const message = String(req.body?.message || '').trim();
    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : null;

    if (!message) return res.status(400).json({ message: 'Noi dung tin nhan khong duoc de trong.' });
    if (message.length > 2000) return res.status(400).json({ message: 'Tin nhan qua dai. Vui long rut gon noi dung.' });
    if (bookingId && !isValidId(bookingId)) return res.status(400).json({ message: 'Ma booking khong hop le.' });

    const [user, session] = await Promise.all([
      getUserProfile(req),
      getOrCreateSession({ userId, bookingId })
    ]);

    const userMessage = { sender: 'user', message, createdAt: new Date() };
    session.messages.push(userMessage);
    await session.save();

    emitToUser(userId, 'ai_typing_start', { sessionId: session._id });

    const aiResult = await generateAiReply({
      user,
      message,
      history: session.messages,
      bookingId
    });

    const aiMessage = { sender: 'ai', message: aiResult.text, createdAt: new Date() };
    session.messages.push(aiMessage);
    await session.save();

    emitToUser(userId, 'ai_typing_stop', { sessionId: session._id });
    emitToUser(userId, 'ai_message', {
      session: serializeSession(session),
      message: session.messages[session.messages.length - 1]
    });

    res.status(201).json({
      session: serializeSession(session),
      reply: aiResult.text,
      message: session.messages[session.messages.length - 1]
    });
  } catch (error) {
    const userId = getUserId(req);
    if (userId) emitToUser(userId, 'ai_typing_stop', {});
    res.status(error.statusCode || 500).json({
      message: 'Khong the gui tin nhan AI.',
      error: error.message
    });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    const sessions = await ChatSession.find({ userId })
      .sort({ updatedAt: -1 })
      .populate('relatedBooking', 'date startTime endTime status paymentStatus field')
      .lean();

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Khong the tai lich su chat AI.', error: error.message });
  }
};

exports.clearHistory = async (req, res) => {
  try {
    const userId = getUserId(req);
    await ChatSession.deleteMany({ userId });
    emitToUser(userId, 'ai_history_cleared', { userId });
    res.json({ message: 'Da xoa lich su chat AI.' });
  } catch (error) {
    res.status(500).json({ message: 'Khong the xoa lich su chat AI.', error: error.message });
  }
};
