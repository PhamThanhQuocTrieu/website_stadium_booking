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
  promotion: 'Khuyến mãi',
  voucher: 'Voucher'
};

export const notificationFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'booking', label: 'Đặt sân' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'cancellation', label: 'Hủy sân' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'system', label: 'Hệ thống' }
];

export const notificationTypeIcons = {
  booking: CalendarCheck,
  payment: CreditCard,
  cancellation: RotateCcw,
  reminder: Bell,
  system: ShieldCheck,
  promotion: Tag,
  voucher: Tag
};

export const getNotificationIcon = (type) => notificationTypeIcons[type] || Megaphone;

const notificationTextReplacements = [
  ['Lich dat san da duoc thay doi', 'Lịch đặt sân đã được thay đổi'],
  ['Lich dat san cua ban da duoc chuyen sang', 'Lịch đặt sân của bạn đã được chuyển sang'],
  ['Lich dat san co dinh da duoc tao', 'Lịch đặt sân cố định đã được tạo'],
  ['Ban da duoc dat lich co dinh vao', 'Bạn đã được đặt lịch cố định vào'],
  ['Lich dat san co dinh da bi huy', 'Lịch đặt sân cố định đã bị hủy'],
  ['Lich dat san co dinh cua ban da duoc huy boi admin', 'Lịch đặt sân cố định của bạn đã được hủy bởi admin'],
  ['Lich dat san co dinh da duoc cap nhat', 'Lịch đặt sân cố định đã được cập nhật'],
  ['Lich co dinh cua ban da duoc cap nhat', 'Lịch cố định của bạn đã được cập nhật'],
  ['Ban vua nhan voucher moi', 'Bạn vừa nhận voucher mới'],
  ['Ban vua nhan voucher', 'Bạn vừa nhận voucher'],
  ['Ap dung ma giam gia thanh cong', 'Áp dụng mã giảm giá thành công'],
  ['Cho thanh toan', 'Chờ thanh toán'],
  ['Don dat san cua ban dang cho thanh toan', 'Đơn đặt sân của bạn đang chờ thanh toán'],
  ['Thanh toan thanh cong', 'Thanh toán thành công'],
  ['Thanh toan cho don dat san cua ban da thanh cong', 'Thanh toán cho đơn đặt sân của bạn đã thành công'],
  ['Dat san thanh cong', 'Đặt sân thành công'],
  ['Ban da dat san', 'Bạn đã đặt sân'],
  [' luc ', ' lúc '],
  [' ngay ', ' ngày '],
  [' tu ', ' từ '],
  [' den ', ' đến '],
  [' giam ', ' giảm '],
  [' cho lan dat san dau tien', ' cho lần đặt sân đầu tiên'],
  [' Tong gia tri lich', ' Tổng giá trị lịch']
];

export const formatNotificationText = (value) => {
  let text = String(value || '');
  notificationTextReplacements.forEach(([from, to]) => {
    text = text.replaceAll(from, to);
  });
  return text;
};

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
