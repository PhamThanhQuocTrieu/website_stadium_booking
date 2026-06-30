import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, RefreshCw, Send, Trash2, UserRound } from 'lucide-react';
import { Button, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import socket from '../../socket';
import TypingBubble from './TypingBubble';

const quickActions = [
  'Tìm sân bóng đá',
  'Tìm sân pickleball',
  'Xem giá sân',
  'Chính sách hủy',
  'Kiểm tra giờ trống',
  'Voucher của tôi'
];

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
};

const normalizeMessage = (message) => ({
  _id: message._id || `local-${message.sender}-${message.createdAt || Date.now()}`,
  sender: message.sender,
  message: message.message,
  createdAt: message.createdAt || new Date().toISOString()
});

const AiChatBox = ({ currentUser, onSwitchToAdmin }) => {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!currentUser?._id) return;
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/ai-chat/history');
      const latestSession = data?.[0] || null;
      setSession(latestSession);
      setMessages((latestSession?.messages || []).map(normalizeMessage));
    } catch (error) {
      Swal.fire('Không thể tải chat AI', error.response?.data?.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUser?._id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!currentUser?._id) return undefined;

    const handleAiMessage = ({ session: nextSession, message }) => {
      if (nextSession?.userId && String(nextSession.userId) !== String(currentUser._id)) return;
      setSession(nextSession || null);
      if (message?._id) {
        setMessages((prev) => (prev.some((item) => item._id === message._id) ? prev : [...prev, normalizeMessage(message)]));
      } else if (nextSession?.messages) {
        setMessages(nextSession.messages.map(normalizeMessage));
      }
      setAiTyping(false);
    };

    const handleTypingStart = () => setAiTyping(true);
    const handleTypingStop = () => setAiTyping(false);
    const handleClear = () => {
      setSession(null);
      setMessages([]);
      setAiTyping(false);
    };

    socket.on('ai_message', handleAiMessage);
    socket.on('ai_typing_start', handleTypingStart);
    socket.on('ai_typing_stop', handleTypingStop);
    socket.on('ai_history_cleared', handleClear);

    return () => {
      socket.off('ai_message', handleAiMessage);
      socket.off('ai_typing_start', handleTypingStart);
      socket.off('ai_typing_stop', handleTypingStop);
      socket.off('ai_history_cleared', handleClear);
    };
  }, [currentUser?._id]);

  useEffect(scrollToBottom, [messages, aiTyping, scrollToBottom]);

  const sendPrompt = async (prompt) => {
    const content = String(prompt || draft).trim();
    if (!content || sending) return;

    const optimisticMessage = normalizeMessage({
      _id: `temp-${Date.now()}`,
      sender: 'user',
      message: content,
      createdAt: new Date().toISOString()
    });

    setDraft('');
    setSending(true);
    setAiTyping(true);
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data } = await axiosClient.post('/ai-chat/send', { message: content });
      setSession(data.session);
      setMessages((data.session?.messages || []).map(normalizeMessage));
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item._id !== optimisticMessage._id));
      Swal.fire('Không thể gửi AI', error.response?.data?.error || error.response?.data?.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setSending(false);
      setAiTyping(false);
    }
  };

  const clearHistory = async () => {
    const result = await Swal.fire({
      title: 'Xóa lịch sử chat AI?',
      text: 'Toàn bộ hội thoại với AI sẽ được xóa.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete('/ai-chat/clear');
      setSession(null);
      setMessages([]);
    } catch (error) {
      Swal.fire('Không thể xóa lịch sử', error.response?.data?.message || 'Vui lòng thử lại.', 'error');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendPrompt();
    }
  };

  return (
    <>
      <div className="ai-chat-toolbar">
        <button type="button" onClick={loadHistory} disabled={loading} title="Tải lại lịch sử">
          <RefreshCw size={16} />
        </button>
        <button type="button" onClick={clearHistory} disabled={!messages.length} title="Xóa lịch sử">
          <Trash2 size={16} />
        </button>
        <Button size="sm" variant="outline-primary" onClick={onSwitchToAdmin}>
          <UserRound size={15} /> Chat admin
        </Button>
      </div>

      <div className="user-chat-body ai-chat-body">
        {loading ? (
          <div className="user-chat-loading"><Spinner size="sm" /> Đang tải lịch sử AI...</div>
        ) : messages.length === 0 ? (
          <div className="ai-chat-welcome">
            <div className="ai-chat-avatar"><Bot size={24} /></div>
            <p>Xin chào, tôi là trợ lý AI ArenaHub. Bạn muốn tìm sân, xem giá hay kiểm tra voucher?</p>
          </div>
        ) : (
          messages.map((item) => {
            const isMine = item.sender === 'user';
            const unsure = item.sender === 'ai' && (item.message.includes('Tôi chưa chắc') || item.message.includes('Toi chua chac'));
            return (
              <div key={item._id} className={`user-chat-message-row ${isMine ? 'mine' : 'theirs'} ai-message-row`}>
                {!isMine && <div className="ai-message-avatar"><Bot size={15} /></div>}
                <div className="user-chat-message">
                  <p>{item.message}</p>
                  {unsure && (
                    <button type="button" className="ai-switch-admin-inline" onClick={onSwitchToAdmin}>
                      Chuyển admin chat
                    </button>
                  )}
                  <span>{formatTime(item.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
        {aiTyping && <TypingBubble align="left" text="AI đang nhập..." />}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-actions">
        {quickActions.map((action) => (
          <button key={action} type="button" onClick={() => sendPrompt(action)} disabled={sending}>
            {action}
          </button>
        ))}
      </div>

      <footer className="user-chat-footer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Hỏi AI về đặt sân..."
          disabled={sending}
        />
        <button type="button" onClick={() => sendPrompt()} disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn AI">
          <Send size={18} />
        </button>
      </footer>
    </>
  );
};

export default AiChatBox;
