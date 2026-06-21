const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { emitToAdmin, emitToUser } = require('../utils/socket');

const getUserId = (req) => req.user?.id || req.user?._id;
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isAdminRole = (role) => {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'super admin';
};
const getSenderRole = (req) => (isAdminRole(req.user?.role) ? 'admin' : 'user');

const conversationPopulate = [
  { path: 'userId', select: 'fullName email phone avatar' },
  { path: 'assignedAdminId', select: 'fullName email phone avatar role' }
];

const normalizeMessageBody = (body) => {
  const type = body.type === 'image' ? 'image' : 'text';
  const content = String(body.content || '').trim();
  const imageUrl = String(body.imageUrl || '').trim();
  return { type, content, imageUrl };
};

const validateMessageBody = ({ type, content, imageUrl }) => {
  if (type === 'text' && !content) return 'Nội dung tin nhắn không được để trống.';
  if (type === 'image' && !imageUrl) return 'Ảnh không được để trống.';
  return null;
};

const getConversationForRequest = async (req, conversationId) => {
  if (!isValidId(conversationId)) {
    return { errorStatus: 400, errorMessage: 'Mã hội thoại không hợp lệ.' };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { errorStatus: 404, errorMessage: 'Không tìm thấy hội thoại.' };
  }

  if (!isAdminRole(req.user?.role) && String(conversation.userId) !== String(getUserId(req))) {
    return { errorStatus: 403, errorMessage: 'Bạn không có quyền truy cập hội thoại này.' };
  }

  return { conversation };
};

const populateConversation = (query) => query.populate(conversationPopulate);

const emitChatUpdates = async ({ conversation, message, senderRole }) => {
  const populatedConversation = await Conversation.findById(conversation._id).populate(conversationPopulate).lean();
  const payload = {
    conversation: populatedConversation,
    message
  };

  if (senderRole === 'user') {
    emitToAdmin('receive_message', payload);
    emitToAdmin('conversation_updated', populatedConversation);
    emitToUser(conversation.userId, 'message_sent', payload);
  } else {
    emitToUser(conversation.userId, 'receive_message', payload);
    emitToUser(conversation.userId, 'conversation_updated', populatedConversation);
    emitToAdmin('message_sent', payload);
    emitToAdmin('conversation_updated', populatedConversation);
  }
};

exports.getConversations = async (req, res) => {
  try {
    const conversations = await populateConversation(
      Conversation.find({})
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean()
    );

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải danh sách hội thoại.', error: error.message });
  }
};

exports.getMyConversation = async (req, res) => {
  try {
    const conversation = await populateConversation(
      Conversation.findOne({ userId: getUserId(req) }).sort({ updatedAt: -1 }).lean()
    );

    res.json(conversation || null);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải hội thoại của bạn.', error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversation, errorStatus, errorMessage } = await getConversationForRequest(req, req.params.id);
    if (errorMessage) return res.status(errorStatus).json({ message: errorMessage });

    const readerRole = getSenderRole(req);
    await markConversationRead(conversation, readerRole, getUserId(req));

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải tin nhắn.', error: error.message });
  }
};

exports.createUserMessage = async (req, res) => {
  try {
    const body = normalizeMessageBody(req.body);
    const validationError = validateMessageBody(body);
    if (validationError) return res.status(400).json({ message: validationError });

    const userId = getUserId(req);
    let conversation = await Conversation.findOne({ userId, status: 'open' }).sort({ updatedAt: -1 });
    if (!conversation) {
      conversation = await Conversation.create({ userId, status: 'open' });
    }

    const message = await createMessageAndUpdateConversation({
      conversation,
      senderId: userId,
      senderRole: 'user',
      body
    });

    await emitChatUpdates({ conversation, message, senderRole: 'user' });
    res.status(201).json({ conversation, message });
  } catch (error) {
    res.status(500).json({ message: 'Không thể gửi tin nhắn.', error: error.message });
  }
};

exports.createConversationMessage = async (req, res) => {
  try {
    const { conversation, errorStatus, errorMessage } = await getConversationForRequest(req, req.params.id);
    if (errorMessage) return res.status(errorStatus).json({ message: errorMessage });

    const senderRole = getSenderRole(req);
    if (conversation.status === 'closed' && senderRole === 'user') {
      return res.status(403).json({ message: 'Cuộc trò chuyện đã đóng. Vui lòng liên hệ lại nếu cần hỗ trợ thêm.' });
    }

    const body = normalizeMessageBody(req.body);
    const validationError = validateMessageBody(body);
    if (validationError) return res.status(400).json({ message: validationError });

    if (conversation.status === 'closed' && senderRole === 'admin') {
      conversation.status = 'open';
    }

    const message = await createMessageAndUpdateConversation({
      conversation,
      senderId: getUserId(req),
      senderRole,
      body
    });

    await emitChatUpdates({ conversation, message, senderRole });
    res.status(201).json({ conversation, message });
  } catch (error) {
    res.status(500).json({ message: 'Không thể gửi tin nhắn.', error: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { conversation, errorStatus, errorMessage } = await getConversationForRequest(req, req.params.id);
    if (errorMessage) return res.status(errorStatus).json({ message: errorMessage });

    const result = await markConversationRead(conversation, getSenderRole(req), getUserId(req));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Không thể đánh dấu đã đọc.', error: error.message });
  }
};

exports.markDelivered = async (req, res) => {
  try {
    const { conversation, errorStatus, errorMessage } = await getConversationForRequest(req, req.params.id);
    if (errorMessage) return res.status(errorStatus).json({ message: errorMessage });

    const receiverRole = getSenderRole(req);
    const senderRole = receiverRole === 'admin' ? 'user' : 'admin';
    const now = new Date();
    const result = await Message.updateMany(
      { conversationId: conversation._id, senderRole, status: 'sent' },
      { $set: { status: 'delivered', deliveredAt: now } }
    );

    const payload = { conversationId: conversation._id, senderRole, deliveredAt: now };
    if (receiverRole === 'admin') {
      emitToUser(conversation.userId, 'message_delivered', payload);
    } else {
      emitToAdmin('message_delivered', payload);
    }

    res.json({ message: 'Đã cập nhật trạng thái đã nhận.', modifiedCount: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật trạng thái đã nhận.', error: error.message });
  }
};

exports.closeConversation = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Mã hội thoại không hợp lệ.' });
    const conversation = await populateConversation(
      Conversation.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true }).lean()
    );
    if (!conversation) return res.status(404).json({ message: 'Không tìm thấy hội thoại.' });

    emitToUser(conversation.userId?._id || conversation.userId, 'conversation_updated', conversation);
    emitToAdmin('conversation_updated', conversation);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Không thể đóng hội thoại.', error: error.message });
  }
};

exports.reopenConversation = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Mã hội thoại không hợp lệ.' });
    const conversation = await populateConversation(
      Conversation.findByIdAndUpdate(req.params.id, { status: 'open' }, { new: true }).lean()
    );
    if (!conversation) return res.status(404).json({ message: 'Không tìm thấy hội thoại.' });

    emitToUser(conversation.userId?._id || conversation.userId, 'conversation_updated', conversation);
    emitToAdmin('conversation_updated', conversation);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Không thể mở lại hội thoại.', error: error.message });
  }
};

async function createMessageAndUpdateConversation({ conversation, senderId, senderRole, body }) {
  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    senderRole,
    content: body.content,
    type: body.type,
    imageUrl: body.imageUrl,
    status: 'sent'
  });

  conversation.lastMessage = body.type === 'image' ? '[Hình ảnh]' : body.content;
  conversation.lastMessageAt = message.createdAt;

  if (senderRole === 'user') {
    conversation.unreadByAdmin += 1;
  } else {
    conversation.unreadByUser += 1;
    if (!conversation.assignedAdminId) conversation.assignedAdminId = senderId;
  }

  await conversation.save();
  return message.toObject();
}

async function markConversationRead(conversation, readerRole, readerId) {
  const senderRole = readerRole === 'admin' ? 'user' : 'admin';
  const now = new Date();

  if (readerRole === 'admin') {
    conversation.unreadByAdmin = 0;
  } else {
    conversation.unreadByUser = 0;
  }
  await conversation.save();

  const result = await Message.updateMany(
    { conversationId: conversation._id, senderRole, status: { $ne: 'seen' } },
    {
      $set: { status: 'seen', seenAt: now },
      $addToSet: { readBy: readerId }
    }
  );

  const payload = { conversationId: conversation._id, senderRole, seenAt: now };
  if (readerRole === 'admin') {
    emitToUser(conversation.userId, 'message_seen', payload);
  } else {
    emitToAdmin('message_seen', payload);
  }

  return { message: 'Đã đánh dấu hội thoại là đã đọc.', modifiedCount: result.modifiedCount || 0 };
}
