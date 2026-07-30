import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import socket, { joinSocketRoom } from '../socket';
import { formatNotificationText, formatTimeAgo, getNotificationIcon } from '../utils/notificationUtils';

const getNotificationKey = (notification) => {
  const metadata = notification?.metadata || {};
  if (metadata.waitlistId) return `waitlist:${metadata.waitlistId}`;
  if (metadata.bookingId && notification?.title) return `booking:${metadata.bookingId}:${notification.title}`;
  if (notification?.relatedId && notification?.title) {
    return `related:${notification.relatedId}:${notification.type}:${notification.title}`;
  }
  return String(notification?._id || '');
};

const dedupeNotifications = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getNotificationKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const NotificationBell = ({ user }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/notifications?limit=5&page=1');
      let nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
      let nextUnreadCount = data.unreadCount || 0;

      if (nextNotifications.length === 0 && nextUnreadCount === 0) {
        await axiosClient.get('/user/vouchers');
        const retry = await axiosClient.get('/notifications?limit=5&page=1');
        nextNotifications = Array.isArray(retry.data.notifications) ? retry.data.notifications : [];
        nextUnreadCount = retry.data.unreadCount || 0;
      }

      setNotifications(dedupeNotifications(nextNotifications));
      setUnreadCount(nextUnreadCount);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Không thể tải thông báo', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return undefined;
    joinSocketRoom(user);
    const handleNewNotification = (notification) => {
      const notificationKey = getNotificationKey(notification);
      setNotifications((prev) => {
        if (prev.some((item) => getNotificationKey(item) === notificationKey)) {
          return prev;
        }
        setUnreadCount((current) => current + 1);
        return [notification, ...prev].slice(0, 5);
      });
    };
    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await axiosClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Không thể đánh dấu thông báo', error);
    }
  };

  const openNotification = async (notification) => {
    try {
      if (!notification.isRead) {
        await axiosClient.patch(`/notifications/${notification._id}/read`);
      }
      setNotifications((prev) => prev.map((item) => (
        item._id === notification._id ? { ...item, isRead: true } : item
      )));
      setUnreadCount((prev) => Math.max(prev - (notification.isRead ? 0 : 1), 0));
      setOpen(false);
      if (notification.link) {
        navigate(notification.link);
      } else if (notification.type === 'voucher') {
        navigate('/my-vouchers');
      } else if (notification.relatedModel === 'Booking' || ['booking', 'payment', 'cancellation'].includes(notification.type)) {
        navigate('/my-bookings');
      } else {
        navigate('/notifications');
      }
    } catch (error) {
      console.error('Không thể mở thông báo', error);
    }
  };

  const goToAll = () => {
    setOpen(false);
    navigate('/notifications');
  };

  return (
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <Button
        variant="link"
        className={`notification-bell-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </Button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-head">
            <div>
              <strong>Thông báo</strong>
              <span>{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Không có thông báo mới'}</span>
            </div>
            <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck size={15} /> Đã đọc
            </button>
          </div>

          <div className="notification-dropdown-list">
            {loading ? (
              <div className="notification-empty"><Spinner animation="border" size="sm" /></div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">Chưa có thông báo.</div>
            ) : (
              notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <button
                    type="button"
                    className={`notification-item ${notification.isRead ? '' : 'is-unread'}`}
                    key={notification._id}
                    onClick={() => openNotification(notification)}
                  >
                    <span className={`notification-type-icon type-${notification.type}`}>
                      <Icon size={17} />
                    </span>
                    <span className="notification-item-body">
                      <strong>{formatNotificationText(notification.title)}</strong>
                      <span>{formatNotificationText(notification.message)}</span>
                      <small>{formatTimeAgo(notification.createdAt)}</small>
                    </span>
                    {!notification.isRead && <i aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>

          <button type="button" className="notification-view-all" onClick={goToAll}>
            Xem tất cả
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
