import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Mail, MessageCircle, Phone, RotateCcw, Search, Send, UserCircle } from 'lucide-react';
import { Button, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import socket from '../../socket';
import TypingBubble from '../../components/chat/TypingBubble';
import '../../styles/admin/chatmanager.css';

const statusText = {
  sending: 'Đang gửi...',
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem'
};

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
};

const getStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo')) || null;
  } catch {
    return null;
  }
};

const getUser = (conversation) => conversation?.userId || {};

const ChatManager = () => {
  const [adminUser] = useState(() => getStoredAdmin());
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selectedId = selectedConversation?._id;
  const selectedUser = getUser(selectedConversation);

  const filteredConversations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((conversation) => {
      const user = getUser(conversation);
      return [user.fullName, user.email, user.phone, conversation.lastMessage]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [conversations, searchTerm]);

  const lastOwnMessageId = useMemo(() => {
    const ownMessages = messages.filter((message) => message.senderRole === 'admin');
    return ownMessages[ownMessages.length - 1]?._id || ownMessages[ownMessages.length - 1]?.tempId;
  }, [messages]);

  const upsertConversation = useCallback((conversation) => {
    if (!conversation?._id) return;
    setConversations((prev) => {
      const next = [conversation, ...prev.filter((item) => item._id !== conversation._id)];
      return next.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
    });
    setSelectedConversation((prev) => (prev?._id === conversation._id ? conversation : prev));
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const { data } = await axiosClient.get('/chat/conversations');
      setConversations(data || []);
    } catch (error) {
      Swal.fire('Không thể tải hội thoại', error.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversation) => {
    if (!conversation?._id) return;
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    setCustomerTyping(false);
    try {
      const { data } = await axiosClient.get(`/chat/conversations/${conversation._id}/messages`);
      setMessages(data || []);
      await axiosClient.put(`/chat/conversations/${conversation._id}/read`).catch(() => {});
      setConversations((prev) => prev.map((item) => (
        item._id === conversation._id ? { ...item, unreadByAdmin: 0 } : item
      )));
      window.dispatchEvent(new Event('adminChatUnreadChanged'));
    } catch (error) {
      Swal.fire('Không thể tải tin nhắn', error.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!adminUser?._id) return;
    if (!socket.connected) socket.connect();
    socket.emit('join_chat', { userId: adminUser._id, role: adminUser.role });
    loadConversations();
  }, [adminUser, loadConversations]);

  useEffect(() => {
    const scrollTimer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    return () => clearTimeout(scrollTimer);
  }, [messages, customerTyping]);

  useEffect(() => {
    const handleReceiveMessage = async ({ conversation, message }) => {
      if (!conversation?._id || !message?._id) return;
      upsertConversation(conversation);
      await axiosClient.put(`/chat/conversations/${conversation._id}/delivered`).catch(() => {});
      if (conversation._id === selectedId) {
        setMessages((prev) => (prev.some((item) => item._id === message._id) ? prev : [...prev, message]));
        setCustomerTyping(false);
        await axiosClient.put(`/chat/conversations/${conversation._id}/read`).catch(() => {});
        window.dispatchEvent(new Event('adminChatUnreadChanged'));
      }
    };

    const handleConversationUpdated = (conversation) => upsertConversation(conversation);

    const handleSent = ({ conversation, message }) => {
      upsertConversation(conversation);
      if (!message?._id || conversation?._id !== selectedId) return;
      setMessages((prev) => prev.map((item) => (item.tempId && item.content === message.content ? message : item)));
    };

    const handleDelivered = ({ conversationId }) => {
      setMessages((prev) => prev.map((item) => (
        item.conversationId === conversationId && item.senderRole === 'admin' ? { ...item, status: 'delivered' } : item
      )));
    };

    const handleSeen = ({ conversationId }) => {
      setMessages((prev) => prev.map((item) => (
        item.conversationId === conversationId && item.senderRole === 'admin' ? { ...item, status: 'seen' } : item
      )));
    };

    const handleTypingStart = ({ conversationId }) => {
      if (conversationId === selectedId) setCustomerTyping(true);
    };

    const handleTypingStop = ({ conversationId }) => {
      if (!conversationId || conversationId === selectedId) setCustomerTyping(false);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('message_sent', handleSent);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_seen', handleSeen);
    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('message_sent', handleSent);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_seen', handleSeen);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
    };
  }, [selectedId, upsertConversation]);

  const emitTyping = () => {
    if (!selectedConversation?._id || !selectedUser?._id) return;
    socket.emit('typing_start', { conversationId: selectedConversation._id, userId: selectedUser._id, role: 'admin' });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: selectedConversation._id, userId: selectedUser._id, role: 'admin' });
    }, 1500);
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || !selectedConversation?._id || sending) return;

    const tempId = `admin-temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      conversationId: selectedConversation._id,
      senderRole: 'admin',
      content,
      type: 'text',
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setDraft('');
    setSending(true);
    setMessages((prev) => [...prev, optimisticMessage]);
    socket.emit('typing_stop', { conversationId: selectedConversation._id, userId: selectedUser._id, role: 'admin' });

    try {
      const { data } = await axiosClient.post(`/chat/conversations/${selectedConversation._id}/messages`, { content, type: 'text' });
      upsertConversation(data.conversation);
      setMessages((prev) => prev.map((item) => (item.tempId === tempId ? data.message : item)));
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.tempId !== tempId));
      Swal.fire('Không thể gửi tin nhắn', error.response?.data?.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedConversation?._id) return;
    const action = status === 'closed' ? 'close' : 'reopen';
    try {
      const { data } = await axiosClient.put(`/chat/conversations/${selectedConversation._id}/${action}`);
      upsertConversation(data);
    } catch (error) {
      Swal.fire('Không thể cập nhật hội thoại', error.response?.data?.message || 'Vui lòng thử lại.', 'error');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="admin-chat-page">
      <aside className="admin-chat-list-panel">
        <div className="admin-chat-list-header">
          <h2>Tin nhắn hỗ trợ</h2>
          <span>{conversations.length} hội thoại</span>
        </div>

        <div className="admin-chat-search">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm tên, email, số điện thoại..."
          />
        </div>

        <div className="admin-chat-conversations">
          {loadingConversations ? (
            <div className="admin-chat-loading"><Spinner size="sm" /> Đang tải...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="admin-chat-empty-list">Chưa có hội thoại phù hợp</div>
          ) : (
            filteredConversations.map((conversation) => {
              const user = getUser(conversation);
              return (
                <button
                  key={conversation._id}
                  type="button"
                  className={`admin-chat-conversation ${selectedId === conversation._id ? 'active' : ''}`}
                  onClick={() => loadMessages(conversation)}
                >
                  <div className="admin-chat-avatar">
                    {user.avatar ? <img src={user.avatar} alt={user.fullName || 'User'} /> : <UserCircle size={34} />}
                  </div>
                  <div className="admin-chat-conversation-main">
                    <div className="admin-chat-conversation-top">
                      <strong>{user.fullName || 'Khách hàng'}</strong>
                      <span>{formatTime(conversation.lastMessageAt || conversation.updatedAt)}</span>
                    </div>
                    <p>{user.email || user.phone || 'Chưa có thông tin liên hệ'}</p>
                    <small>{conversation.lastMessage || 'Chưa có tin nhắn'}</small>
                    <div className="admin-chat-conversation-meta">
                      <em className={conversation.status === 'closed' ? 'closed' : 'open'}>
                        {conversation.status === 'closed' ? 'Đã đóng' : 'Đang hỗ trợ'}
                      </em>
                      {conversation.unreadByAdmin > 0 && <b>{conversation.unreadByAdmin}</b>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="admin-chat-detail-panel">
        {!selectedConversation ? (
          <div className="admin-chat-empty-state">
            <MessageCircle size={54} />
            <h3>Chọn một cuộc trò chuyện để bắt đầu hỗ trợ</h3>
          </div>
        ) : (
          <>
            <header className="admin-chat-detail-header">
              <div className="admin-chat-avatar large">
                {selectedUser.avatar ? <img src={selectedUser.avatar} alt={selectedUser.fullName || 'User'} /> : <UserCircle size={42} />}
              </div>
              <div className="admin-chat-user-info">
                <h3>{selectedUser.fullName || 'Khách hàng'}</h3>
                <span><Mail size={14} /> {selectedUser.email || 'Chưa có email'}</span>
                <span><Phone size={14} /> {selectedUser.phone || 'Chưa có số điện thoại'}</span>
              </div>
              <div className="admin-chat-actions">
                <span className={`admin-chat-status-pill ${selectedConversation.status}`}>
                  {selectedConversation.status === 'closed' ? 'Đã đóng' : 'Đang hỗ trợ'}
                </span>
                {selectedConversation.status === 'closed' ? (
                  <Button variant="outline-success" size="sm" onClick={() => updateStatus('open')}>
                    <RotateCcw size={16} /> Mở lại hội thoại
                  </Button>
                ) : (
                  <Button variant="outline-danger" size="sm" onClick={() => updateStatus('closed')}>
                    <Archive size={16} /> Đóng hội thoại
                  </Button>
                )}
              </div>
            </header>

            <div className="admin-chat-messages">
              {loadingMessages ? (
                <div className="admin-chat-loading"><Spinner size="sm" /> Đang tải tin nhắn...</div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isMine = message.senderRole === 'admin';
                    const messageId = message._id || message.tempId;
                    return (
                      <motion.div
                        key={messageId}
                        className={`admin-chat-message-row ${isMine ? 'mine' : 'theirs'}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="admin-chat-message">
                          {message.type === 'image' ? <img src={message.imageUrl} alt="Chat" /> : <p>{message.content}</p>}
                          <span>{formatTime(message.createdAt)}</span>
                        </div>
                        {isMine && messageId === lastOwnMessageId && (
                          <small>{statusText[message.status] || 'Đã gửi'}</small>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
              {customerTyping && <TypingBubble align="left" text="Khách hàng đang nhập..." />}
              <div ref={messagesEndRef} />
            </div>

            <footer className="admin-chat-reply">
              <textarea
                rows={1}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  emitTyping();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tin nhắn trả lời..."
                disabled={sending}
              />
              <button type="button" onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn">
                <Send size={18} />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
};

export default ChatManager;
