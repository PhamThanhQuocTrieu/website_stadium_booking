import React, { useCallback, useEffect, useState } from 'react';
import { Button, Container, Spinner } from 'react-bootstrap';
import { CheckCheck, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  formatTimeAgo,
  formatNotificationText,
  getNotificationIcon,
  notificationFilters,
  notificationTypeLabels
} from '../utils/notificationUtils';
import '../styles/NotificationsPage.css';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (nextPage = 1, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '10'
      });
      if (filter === 'unread') params.append('unread', 'true');
      if (filter && filter !== 'unread') params.append('type', filter);

      const { data } = await axiosClient.get(`/notifications?${params.toString()}`);
      const items = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications((prev) => (append ? [...prev, ...items] : items));
      setUnreadCount(data.unreadCount || 0);
      setPage(data.page || nextPage);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải thông báo.', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await axiosClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      Swal.fire('Thành công', 'Đã đánh dấu tất cả thông báo là đã đọc.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể cập nhật thông báo.', 'error');
    }
  };

  const openNotification = async (notification) => {
    try {
      if (!notification.isRead) {
        await axiosClient.patch(`/notifications/${notification._id}/read`);
        setNotifications((prev) => prev.map((item) => (
          item._id === notification._id ? { ...item, isRead: true } : item
        )));
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
      if (notification.link) {
        navigate(notification.link);
      } else if (notification.relatedModel === 'Booking' || ['booking', 'payment', 'cancellation'].includes(notification.type)) {
        navigate('/my-bookings');
      }
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể mở thông báo.', 'error');
    }
  };

  const deleteNotification = async (event, notificationId) => {
    event.stopPropagation();
    const result = await Swal.fire({
      title: 'Xóa thông báo?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete(`/notifications/${notificationId}`);
      setNotifications((prev) => {
        const deleted = prev.find((item) => item._id === notificationId);
        if (deleted && !deleted.isRead) {
          setUnreadCount((current) => Math.max(current - 1, 0));
        }
        return prev.filter((item) => item._id !== notificationId);
      });
      Swal.fire('Đã xóa', 'Thông báo đã được xóa.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể xóa thông báo.', 'error');
    }
  };

  return (
    <div className="notifications-page">
      <Container className="notifications-container">
        <div className="notifications-header">
          <div>
            <span>ARENAHUB</span>
            <h1>Thông báo</h1>
            <p>Theo dõi cập nhật đặt sân, thanh toán, hủy sân và thông báo hệ thống.</p>
          </div>
          <Button className="notifications-read-all" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck size={18} /> Đánh dấu tất cả đã đọc
          </Button>
        </div>

        <div className="notifications-filter">
          {notificationFilters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? 'active' : ''}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="notifications-panel">
          {loading ? (
            <div className="notifications-state"><Spinner animation="border" variant="success" /></div>
          ) : notifications.length === 0 ? (
            <div className="notifications-state">Chưa có thông báo phù hợp.</div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <button
                    type="button"
                    key={notification._id}
                    className={`notifications-row ${notification.isRead ? '' : 'is-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className={`notifications-row-icon type-${notification.type}`}>
                      <Icon size={20} />
                    </span>
                    <span className="notifications-row-content">
                      <span className="notifications-row-top">
                        <strong>{formatNotificationText(notification.title)}</strong>
                        <small>{formatTimeAgo(notification.createdAt)}</small>
                      </span>
                      <span className="notifications-row-message">{formatNotificationText(notification.message)}</span>
                      <span className="notifications-row-type">{notificationTypeLabels[notification.type] || 'Thông báo'}</span>
                    </span>
                    {!notification.isRead && <i aria-hidden="true" />}
                    <span
                      role="button"
                      tabIndex={0}
                      className="notifications-delete-btn"
                      onClick={(event) => deleteNotification(event, notification._id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') deleteNotification(event, notification._id);
                      }}
                    >
                      <Trash2 size={17} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && page < totalPages && (
            <div className="notifications-more">
              <Button variant="outline-success" onClick={() => fetchNotifications(page + 1, true)} disabled={loadingMore}>
                {loadingMore ? <Spinner animation="border" size="sm" /> : 'Xem thêm'}
              </Button>
            </div>
          )}
        </section>
      </Container>
    </div>
  );
};

export default NotificationsPage;
