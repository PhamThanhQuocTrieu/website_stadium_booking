import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gift,
  ListChecks,
  MapPin,
  MessageSquareText,
  SearchX,
  Star,
  TicketPercent,
  TrendingUp,
  Trophy,
  UserRound,
  Users
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import socket, { joinSocketRoom } from '../../socket';
import '../../styles/admin/dashboard.css';

const timeFilters = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' }
];

const emptyDashboard = {
  stats: {},
  revenueChart: [],
  bookingChart: [],
  fieldStatus: [],
  recentBookings: [],
  topFields: [],
  topUsers: [],
  latestReviews: [],
  activityLogs: []
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return 'Vừa xong';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const statusMap = {
  pending: 'Đang chờ',
  confirmed: 'Đã xác nhận',
  success: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  playing: 'Đang diễn ra',
  cancel_requested: 'Chờ hủy',
  refunded: 'Đã hoàn tiền',
  pending_payment: 'Chờ thanh toán'
};

const paymentStatusMap = {
  unpaid: 'Chưa thanh toán',
  pending: 'Chờ thanh toán',
  deposit: 'Đã đặt cọc',
  paid: 'Đã thanh toán',
  success: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Đã hoàn tiền'
};

const fieldStatusMap = {
  Active: 'Hoạt động',
  Maintenance: 'Bảo trì',
  Full: 'Đã kín lịch'
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const formatStatus = (value) => statusMap[normalizeKey(value)] || fieldStatusMap[value] || value || 'Chưa cập nhật';
const formatPaymentStatus = (value) => paymentStatusMap[normalizeKey(value)] || value || 'Chưa cập nhật';

const getAvatarFallback = (name = 'A') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'A';

const getImageUrl = (image) => {
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || image.startsWith('/')) return image;
  return `/${image}`;
};

const getTone = (status) => {
  const key = normalizeKey(status);
  if (['paid', 'success', 'confirmed', 'completed', 'active'].includes(key)) return 'success';
  if (['pending', 'pending_payment', 'deposit', 'maintenance', 'cancel_requested'].includes(key)) return 'warning';
  if (['cancelled', 'canceled', 'failed', 'full'].includes(key)) return 'danger';
  return 'neutral';
};

const EmptyState = ({ text = 'Chưa có dữ liệu' }) => (
  <div className="admin-dashboard-empty">
    <SearchX size={34} />
    <span>{text}</span>
  </div>
);

const SkeletonBlock = ({ className = '' }) => <div className={`admin-dashboard-skeleton ${className}`} />;

const Avatar = ({ src, name, size = 'md' }) => (
  <div className={`admin-dashboard-avatar avatar-${size}`}>
    {src ? <img src={getImageUrl(src)} alt={name || 'Avatar'} /> : <span>{getAvatarFallback(name)}</span>}
  </div>
);

const Panel = ({ title, icon, action, children, className = '' }) => (
  <section className={`admin-dashboard-panel ${className}`}>
    <div className="admin-dashboard-panel-head">
      <div>
        <span className="panel-icon">{icon}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const StatCard = ({ item, loading }) => (
  <motion.article className="admin-dashboard-stat" whileHover={{ y: -4 }} transition={{ duration: 0.18 }}>
    {loading ? (
      <>
        <SkeletonBlock className="skeleton-stat-icon" />
        <SkeletonBlock className="skeleton-stat-line" />
        <SkeletonBlock className="skeleton-stat-value" />
      </>
    ) : (
      <>
        <div className={`admin-dashboard-stat-icon ${item.tone}`}>{item.icon}</div>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.description}</small>
      </>
    )}
  </motion.article>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-dashboard-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          {entry.name}: {entry.dataKey === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
        </span>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const [range, setRange] = useState('7d');
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/admin/dashboard', { params: { range } });
      setDashboard({ ...emptyDashboard, ...data });
    } catch (err) {
      setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let userInfo = null;
    try {
      userInfo = JSON.parse(localStorage.getItem('userInfo'));
    } catch {
      userInfo = null;
    }

    joinSocketRoom(userInfo);
    const refreshEvents = [
      'booking_created',
      'booking_updated',
      'payment_success',
      'field_updated',
      'review_created',
      'slot_booked_success',
      'booking_cancelled',
      'booking_cancel_requested'
    ];
    const refresh = () => loadDashboard(true);
    refreshEvents.forEach((event) => socket.on(event, refresh));

    return () => {
      refreshEvents.forEach((event) => socket.off(event, refresh));
    };
  }, [loadDashboard]);

  const stats = dashboard.stats || {};
  const statCards = useMemo(() => [
    {
      label: 'Tổng người dùng',
      value: formatNumber(stats.totalUsers),
      description: 'Tài khoản trong hệ thống',
      icon: <Users size={22} />,
      tone: 'green'
    },
    {
      label: 'Tổng lượt đặt sân',
      value: formatNumber(stats.totalBookings),
      description: 'Tất cả đơn đã ghi nhận',
      icon: <CalendarCheck size={22} />,
      tone: 'blue'
    },
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrency(stats.todayRevenue),
      description: 'Từ các đơn đã thanh toán',
      icon: <CircleDollarSign size={22} />,
      tone: 'green'
    },
    {
      label: 'Tổng doanh thu',
      value: formatCurrency(stats.totalRevenue),
      description: 'Doanh thu tích lũy',
      icon: <TrendingUp size={22} />,
      tone: 'purple'
    },
    {
      label: 'Sân đang hoạt động',
      value: formatNumber(stats.activeFields),
      description: 'Sân sẵn sàng nhận lịch',
      icon: <MapPin size={22} />,
      tone: 'cyan'
    },
    {
      label: 'Voucher đang hoạt động',
      value: formatNumber(stats.activeVouchers),
      description: 'Ưu đãi còn hiệu lực',
      icon: <TicketPercent size={22} />,
      tone: 'amber'
    },
    {
      label: 'Đánh giá trung bình',
      value: `${Number(stats.averageRating || 0).toFixed(1)}/5`,
      description: 'Điểm hài lòng khách hàng',
      icon: <Star size={22} />,
      tone: 'amber'
    }
  ], [stats]);

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <p>Admin Dashboard</p>
          <h1>Xin chào, Admin 👋</h1>
          <span>Đây là tổng quan hoạt động hệ thống hôm nay</span>
        </div>

        <div className="admin-dashboard-filter" aria-label="Bộ lọc thời gian">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={range === filter.value ? 'active' : ''}
              onClick={() => setRange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>

      {error && <Alert className="admin-dashboard-alert" variant="danger">{error}</Alert>}

      <section className="admin-dashboard-stats">
        {statCards.map((item) => <StatCard key={item.label} item={item} loading={loading} />)}
      </section>

      <section className="admin-dashboard-grid two-columns">
        <Panel title="Doanh thu theo thời gian" icon={<CircleDollarSign size={18} />}>
          {loading ? (
            <SkeletonBlock className="skeleton-chart" />
          ) : dashboard.revenueChart?.length ? (
            <div className="admin-dashboard-chart">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboard.revenueChart} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line name="Doanh thu" type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="Lượt đặt sân" icon={<ListChecks size={18} />}>
          {loading ? (
            <SkeletonBlock className="skeleton-chart" />
          ) : dashboard.bookingChart?.length ? (
            <div className="admin-dashboard-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboard.bookingChart} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar name="Lượt đặt" dataKey="bookings" fill="#2563eb" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </Panel>
      </section>

      <section className="admin-dashboard-grid two-columns wide-left">
        <Panel title="Tình trạng sân hôm nay" icon={<MapPin size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.fieldStatus?.length ? (
            <div className="admin-dashboard-list scrollable">
              {dashboard.fieldStatus.map((field) => (
                <article className="field-status-row" key={field._id}>
                  <img src={getImageUrl(field.image) || '/favicon.svg'} alt={field.fieldName} />
                  <div>
                    <div className="row-title">
                      <strong>{field.fieldName}</strong>
                      <span className={`status-pill ${getTone(field.status)}`}>{fieldStatusMap[field.status] || field.status}</span>
                    </div>
                    <p>{field.type || 'Chưa phân loại'} • {field.todayBookingCount || 0} lượt đặt hôm nay</p>
                    <div className="progress-track">
                      <span style={{ width: `${field.occupancyRate || 0}%` }} />
                    </div>
                  </div>
                  <b>{field.occupancyRate || 0}%</b>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="Đơn đặt gần đây" icon={<Clock3 size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.recentBookings?.length ? (
            <div className="admin-dashboard-table-wrap">
              <table className="admin-dashboard-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Sân</th>
                    <th>Ngày</th>
                    <th>Giờ</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Thanh toán</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentBookings.map((booking) => (
                    <tr key={booking._id}>
                      <td data-label="Khách hàng">
                        <div className="customer-cell">
                          <Avatar src={booking.user?.avatar} name={booking.user?.fullName || booking.customerName} size="sm" />
                          <span>{booking.user?.fullName || booking.customerName || 'Khách vãng lai'}</span>
                        </div>
                      </td>
                      <td data-label="Sân">{booking.field?.fieldName || 'Sân đã xóa'}</td>
                      <td data-label="Ngày">{formatDate(booking.date)}</td>
                      <td data-label="Giờ">{booking.slots?.join(', ') || 'Chưa cập nhật'}</td>
                      <td data-label="Tổng tiền">{formatCurrency(booking.totalPrice)}</td>
                      <td data-label="Trạng thái"><span className={`status-pill ${getTone(booking.status)}`}>{formatStatus(booking.status)}</span></td>
                      <td data-label="Thanh toán"><span className={`status-pill ${getTone(booking.paymentStatus)}`}>{formatPaymentStatus(booking.paymentStatus)}</span></td>
                      <td><a className="view-link" href="/admin/bookings">Xem <ChevronRight size={15} /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState />}
        </Panel>
      </section>

      <section className="admin-dashboard-grid two-columns">
        <Panel title="Top sân được đặt nhiều" icon={<Trophy size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.topFields?.length ? (
            <div className="admin-dashboard-list">
              {dashboard.topFields.map((field, index) => (
                <article className="ranking-row" key={field._id}>
                  <span className="rank-number">{index + 1}</span>
                  <img src={getImageUrl(field.image) || '/favicon.svg'} alt={field.fieldName} />
                  <div>
                    <strong>{field.fieldName}</strong>
                    <p>{field.type || 'Chưa phân loại'} • {formatNumber(field.totalBookings)} lượt đặt</p>
                  </div>
                  <b>{formatCurrency(field.revenue)}</b>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="Top khách hàng" icon={<UserRound size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.topUsers?.length ? (
            <div className="admin-dashboard-list">
              {dashboard.topUsers.map((user) => (
                <article className="user-row" key={user._id}>
                  <Avatar src={user.avatar} name={user.fullName} />
                  <div>
                    <strong>{user.fullName}</strong>
                    <p>{user.email || 'Chưa có email'}</p>
                  </div>
                  <div className="row-metrics">
                    <span>{formatNumber(user.totalBookings)} lượt</span>
                    <b>{formatCurrency(user.totalSpent)}</b>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>
      </section>

      <section className="admin-dashboard-grid two-columns">
        <Panel title="Đánh giá mới nhất" icon={<MessageSquareText size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.latestReviews?.length ? (
            <div className="admin-dashboard-list">
              {dashboard.latestReviews.map((review) => (
                <article className="review-row" key={review._id}>
                  <Avatar src={review.user?.avatar} name={review.user?.fullName} />
                  <div>
                    <div className="row-title">
                      <strong>{review.user?.fullName || 'Khách hàng'}</strong>
                      <span className="rating"><Star size={14} fill="currentColor" /> {review.rating}/5</span>
                    </div>
                    <p>{review.field?.fieldName || 'Sân'} • {review.comment}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="Hoạt động gần đây" icon={<Activity size={18} />}>
          {loading ? (
            <div className="admin-dashboard-list">{Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}</div>
          ) : dashboard.activityLogs?.length ? (
            <div className="activity-timeline">
              {dashboard.activityLogs.map((activity, index) => (
                <article className="activity-row" key={`${activity.type}-${index}`}>
                  <span className="activity-dot"><Gift size={14} /></span>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.description}</p>
                    <small>{formatDateTime(activity.time)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>
      </section>
    </div>
  );
};

export default Dashboard;
