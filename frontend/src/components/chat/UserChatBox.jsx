import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Headphones, LogIn, MessageCircle, Send, X } from 'lucide-react';
import { Button, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import socket from '../../socket';
import AiChatBox from './AiChatBox';
import TypingBubble from './TypingBubble';
import '../../styles/chat/UserChatBox.css';

const statusText = {
  sending: 'Đang gửi...',
  sent: 'Đã gửi',
  delivered: 'Đã nhận',
  seen: 'Đã xem'
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('userInfo')) || null;
  } catch {
    return null;
  }
};

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};

const normalizeConversation = (payload) => payload?.conversation || payload;

const getChatErrorMessage = (error) => {
  if (error.response?.status === 404) {
    return 'API chat chưa được backend hiện tại load. Hãy restart server Node.js rồi thử lại.';
  }
  return error.response?.data?.message || 'Vui lòng thử lại.';
};

const CHAT_FAB_SIZE = 58;
const CHAT_FAB_MARGIN = 14;

const clampChatPosition = (position) => ({
  x: Math.min(Math.max(CHAT_FAB_MARGIN, position.x), window.innerWidth - CHAT_FAB_SIZE - CHAT_FAB_MARGIN),
  y: Math.min(Math.max(CHAT_FAB_MARGIN, position.y), window.innerHeight - CHAT_FAB_SIZE - CHAT_FAB_MARGIN)
});

const getDefaultChatPosition = () => {
  if (typeof window === 'undefined') return { x: 24, y: 24 };
  try {
    const savedPosition = JSON.parse(localStorage.getItem('userChatPosition') || 'null');
    if (savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) {
      return clampChatPosition(savedPosition);
    }
  } catch {
    // Ignore broken saved positions and fall back to the default corner.
  }
  return {
    x: window.innerWidth - CHAT_FAB_SIZE - 24,
    y: window.innerHeight - CHAT_FAB_SIZE - 24
  };
};

const UserChatBox = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [adminTyping, setAdminTyping] = useState(false);
  const [activeChatMode, setActiveChatMode] = useState('ai');
  const [chatPosition, setChatPosition] = useState(getDefaultChatPosition);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const dragStateRef = useRef(null);

  const unreadCount = conversation?.unreadByUser || 0;
  const isClosed = conversation?.status === 'closed';
  const isLoggedIn = Boolean(currentUser?._id);

  const lastOwnMessageId = useMemo(() => {
    const ownMessages = messages.filter((message) => message.senderRole === 'user');
    return ownMessages[ownMessages.length - 1]?._id || ownMessages[ownMessages.length - 1]?.tempId;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, []);

  const joinChat = useCallback((user = currentUser) => {
    if (!user?._id) return;
    if (!socket.connected) socket.connect();
    socket.emit('join_chat', { userId: user._id, role: user.role });
  }, [currentUser]);

  const loadConversation = useCallback(async () => {
    if (!currentUser?._id) return;
    setLoading(true);
    setChatError('');
    try {
      const { data } = await axiosClient.get('/chat/conversations/my');
      setConversation(data);
      if (data?._id) {
        const messagesRes = await axiosClient.get(`/chat/conversations/${data._id}/messages`);
        setMessages(messagesRes.data || []);
        await axiosClient.put(`/chat/conversations/${data._id}/read`).catch(() => {});
      } else {
        setMessages([]);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        setChatError(getChatErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getStoredUser());
    window.addEventListener('storage', syncUser);
    window.addEventListener('authChanged', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('authChanged', syncUser);
    };
  }, []);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, [location.pathname, isOpen]);

  useEffect(() => {
    if (!currentUser?._id) return;
    joinChat(currentUser);
    loadConversation();
  }, [currentUser, joinChat, loadConversation]);

  useEffect(() => {
    if (!currentUser?._id) return undefined;

    const handleReceiveMessage = async ({ conversation: incomingConversation, message }) => {
      const nextConversation = normalizeConversation(incomingConversation);
      if (!nextConversation?._id || String(nextConversation.userId?._id || nextConversation.userId) !== String(currentUser._id)) return;

      setConversation(nextConversation);
      setMessages((prev) => {
        if (prev.some((item) => item._id === message._id)) return prev;
        return [...prev, message];
      });
      setAdminTyping(false);
      await axiosClient.put(`/chat/conversations/${nextConversation._id}/delivered`).catch(() => {});
      if (isOpen) await axiosClient.put(`/chat/conversations/${nextConversation._id}/read`).catch(() => {});
    };

    const handleConversationUpdated = (payload) => {
      const nextConversation = normalizeConversation(payload);
      if (!nextConversation?._id) return;
      const ownerId = nextConversation.userId?._id || nextConversation.userId;
      if (String(ownerId) === String(currentUser._id)) setConversation(nextConversation);
    };

    const handleSent = ({ conversation: nextConversation, message }) => {
      if (!message?._id) return;
      setConversation(normalizeConversation(nextConversation));
      setMessages((prev) => prev.map((item) => (item.tempId && item.content === message.content ? message : item)));
    };

    const updateOwnStatuses = (status) => ({ conversationId }) => {
      if (!conversationId) return;
      setMessages((prev) => prev.map((item) => (
        item.conversationId === conversationId && item.senderRole === 'user' ? { ...item, status } : item
      )));
    };
    const handleDelivered = updateOwnStatuses('delivered');
    const handleSeen = updateOwnStatuses('seen');

    const handleTypingStart = ({ conversationId }) => {
      if (conversation?._id && String(conversationId) === String(conversation._id)) setAdminTyping(true);
    };
    const handleTypingStop = ({ conversationId }) => {
      if (!conversationId || String(conversationId) === String(conversation?._id)) setAdminTyping(false);
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
  }, [conversation?._id, currentUser, isOpen]);

  useEffect(scrollToBottom, [messages, adminTyping, isOpen, scrollToBottom]);

  useEffect(() => {
    const keepChatInViewport = () => {
      setChatPosition((prev) => {
        const next = clampChatPosition(prev);
        localStorage.setItem('userChatPosition', JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener('resize', keepChatInViewport);
    return () => window.removeEventListener('resize', keepChatInViewport);
  }, []);

  useEffect(() => {
    if (isOpen && conversation?._id) {
      axiosClient.put(`/chat/conversations/${conversation._id}/read`).catch(() => {});
      setConversation((prev) => (prev ? { ...prev, unreadByUser: 0 } : prev));
    }
  }, [isOpen, conversation?._id]);

  const emitTyping = () => {
    if (!conversation?._id || !currentUser?._id) return;
    socket.emit('typing_start', { conversationId: conversation._id, userId: currentUser._id, role: 'user' });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: conversation._id, userId: currentUser._id, role: 'user' });
    }, 1500);
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || sending || isClosed) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      tempId,
      _id: tempId,
      content,
      type: 'text',
      senderRole: 'user',
      status: 'sending',
      createdAt: new Date().toISOString(),
      conversationId: conversation?._id
    };

    setDraft('');
    setSending(true);
    setMessages((prev) => [...prev, optimisticMessage]);
    socket.emit('typing_stop', { conversationId: conversation?._id, userId: currentUser._id, role: 'user' });

    try {
      const endpoint = conversation?._id ? `/chat/conversations/${conversation._id}/messages` : '/chat/messages';
      const { data } = await axiosClient.post(endpoint, { content, type: 'text' });
      setConversation(data.conversation);
      setMessages((prev) => prev.map((item) => (item.tempId === tempId ? data.message : item)));
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.tempId !== tempId));
      Swal.fire('Không thể gửi tin nhắn', getChatErrorMessage(error), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleFabPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: chatPosition.x,
      originY: chatPosition.y,
      moved: false
    };
  };

  const handleFabPointerMove = (event) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) state.moved = true;
    if (!state.moved) return;

    event.preventDefault();
    setChatPosition(clampChatPosition({
      x: state.originX + deltaX,
      y: state.originY + deltaY
    }));
  };

  const handleFabPointerUp = (event) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const wasDragged = state.moved;
    dragStateRef.current = wasDragged ? { blockClick: true } : null;
    if (wasDragged) {
      setChatPosition((prev) => {
        const next = clampChatPosition(prev);
        localStorage.setItem('userChatPosition', JSON.stringify(next));
        return next;
      });
      setTimeout(() => {
        if (dragStateRef.current?.blockClick) dragStateRef.current = null;
      }, 0);
    }
  };

  const handleFabClick = () => {
    if (dragStateRef.current?.blockClick) {
      dragStateRef.current = null;
      return;
    }
    setIsOpen((value) => !value);
  };

  const alignPanelLeft = typeof window !== 'undefined' && chatPosition.x < 400;

  return (
    <div className="user-chat-root" style={{ left: chatPosition.x, top: chatPosition.y }}>
      <button
        type="button"
        className="user-chat-fab"
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerUp}
        onClick={handleFabClick}
        aria-label="Mở chat hỗ trợ"
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && <span className="user-chat-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.section
            className={`user-chat-panel ${alignPanelLeft ? 'align-left' : ''}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          >
            <header className="user-chat-header">
              <div className="user-chat-support-avatar">{activeChatMode === 'ai' ? <Bot size={21} /> : 'AH'}</div>
              <div>
                <h3>Hỗ trợ khách hàng</h3>
                <p>Thường phản hồi trong vài phút</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Đóng chat">
                <X size={18} />
              </button>
            </header>

            {!isLoggedIn ? (
              <div className="user-chat-login">
                <MessageCircle size={42} />
                <p>Vui lòng đăng nhập để chat với admin</p>
                <Button onClick={() => navigate('/login')}>
                  <LogIn size={17} /> Đăng nhập
                </Button>
              </div>
            ) : (
              <>
                <div className="user-chat-tabs" role="tablist" aria-label="Chon kenh ho tro">
                  <button
                    type="button"
                    className={activeChatMode === 'ai' ? 'active' : ''}
                    onClick={() => setActiveChatMode('ai')}
                  >
                    <Bot size={16} /> Chat voi AI
                  </button>
                  <button
                    type="button"
                    className={activeChatMode === 'admin' ? 'active' : ''}
                    onClick={() => setActiveChatMode('admin')}
                  >
                    <Headphones size={16} /> Chat voi Admin
                    {unreadCount > 0 && <span>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                </div>

                {activeChatMode === 'ai' ? (
                  <AiChatBox currentUser={currentUser} onSwitchToAdmin={() => setActiveChatMode('admin')} />
                ) : (
                  <>
                <div className="user-chat-body">
                  {loading ? (
                    <div className="user-chat-loading"><Spinner size="sm" /> Đang tải hội thoại...</div>
                  ) : chatError ? (
                    <div className="user-chat-error">
                      <MessageCircle size={32} />
                      <p>Không thể tải chat</p>
                      <span>{chatError}</span>
                      <Button size="sm" onClick={loadConversation}>Thử lại</Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="user-chat-empty">Xin chào, ArenaHub có thể hỗ trợ gì cho bạn?</div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.senderRole === 'user';
                      const messageId = message._id || message.tempId;
                      return (
                        <motion.div
                          key={messageId}
                          className={`user-chat-message-row ${isMine ? 'mine' : 'theirs'}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="user-chat-message">
                            {message.type === 'image' ? <img src={message.imageUrl} alt="Chat" /> : <p>{message.content}</p>}
                            <span>{formatTime(message.createdAt)}</span>
                          </div>
                          {isMine && messageId === lastOwnMessageId && (
                            <small className="user-chat-status">{statusText[message.status] || 'Đã gửi'}</small>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                  {adminTyping && <TypingBubble align="left" text="Admin đang nhập..." />}
                  <div ref={messagesEndRef} />
                </div>

                {isClosed && (
                  <div className="user-chat-closed">
                    Cuộc trò chuyện đã được đóng. Vui lòng liên hệ lại nếu cần hỗ trợ thêm.
                  </div>
                )}

                <footer className="user-chat-footer">
                  <textarea
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      emitTyping();
                    }}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={isClosed ? 'Cuộc trò chuyện đã đóng' : 'Nhập tin nhắn...'}
                    disabled={isClosed || sending}
                  />
                  <button type="button" onClick={sendMessage} disabled={!draft.trim() || sending || isClosed} aria-label="Gửi tin nhắn">
                    <Send size={18} />
                  </button>
                </footer>
                  </>
                )}
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserChatBox;
