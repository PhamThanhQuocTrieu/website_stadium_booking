import {
  Bell,
  CalendarCheck,
  CreditCard,
  Megaphone,
  RotateCcw,
  ShieldCheck,
  Tag
} from 'lucide-react';

export const notificationTypeLabels = {
  booking: 'Đặt sân',
  payment: 'Thanh toán',
  cancellation: 'Hủy sân',
  reminder: 'Nhắc lịch',
  system: 'Hệ thống',
  promotion: 'Khuyến mãi'
};

export const notificationFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'booking', label: 'Đặt sân' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'cancellation', label: 'Hủy sân' },
  { value: 'system', label: 'Hệ thống' }
];

export const notificationTypeIcons = {
  booking: CalendarCheck,
  payment: CreditCard,
  cancellation: RotateCcw,
  reminder: Bell,
  system: ShieldCheck,
  promotion: Tag
};

export const getNotificationIcon = (type) => notificationTypeIcons[type] || Megaphone;

export const formatTimeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0);
  if (diffSeconds < 60) return 'Vừa xong';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN');
};
