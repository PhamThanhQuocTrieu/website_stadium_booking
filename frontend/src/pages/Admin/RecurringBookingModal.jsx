import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import RecurringBookingCheckResult from './RecurringBookingCheckResult';

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatVietnameseDate = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const parseVietnameseDate = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return '';
  }

  return formatLocalDate(date);
};

const addMonths = (date, months) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const defaultForm = {
  customerId: '',
  customerName: '',
  customerPhone: '',
  courtId: '',
  startDate: formatLocalDate(new Date()),
  endDate: formatLocalDate(addMonths(new Date(), 1)),
  daysOfWeek: [2, 4],
  startTime: '17:00',
  endTime: '18:00',
  note: '',
  paymentStatus: 'unpaid',
  createOnlyAvailableSlots: false
};

const timeOptions = Array.from({ length: 37 }, (_, index) => {
  const totalMinutes = 5 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minute = String(totalMinutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
});

const weekDays = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' }
];

const VietnameseDateInput = ({ value, onChange }) => {
  const [displayValue, setDisplayValue] = useState(formatVietnameseDate(value));

  useEffect(() => {
    setDisplayValue(formatVietnameseDate(value));
  }, [value]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    const parsedValue = parseVietnameseDate(nextValue);
    if (parsedValue) onChange(parsedValue);
  };

  const handleBlur = () => {
    const parsedValue = parseVietnameseDate(displayValue);
    setDisplayValue(parsedValue ? formatVietnameseDate(parsedValue) : formatVietnameseDate(value));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

const RecurringBookingModal = ({ open, resources, onClose, onCreated, editingItem }) => {
  const [form, setForm] = useState(defaultForm);
  const [users, setUsers] = useState([]);
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setCheckResult(null);
    if (editingItem) {
      setForm({
        ...defaultForm,
        customerId: editingItem.customer?._id || '',
        customerName: editingItem.customerName || editingItem.customer?.fullName || '',
        customerPhone: editingItem.customerPhone || editingItem.customer?.phone || '',
        courtId: editingItem.court?._id || editingItem.court || '',
        startDate: editingItem.startDate,
        endDate: editingItem.endDate,
        daysOfWeek: editingItem.daysOfWeek || [],
        startTime: editingItem.startTime,
        endTime: editingItem.endTime,
        note: editingItem.note || '',
        paymentStatus: editingItem.paymentStatus || 'unpaid'
      });
    } else {
      setForm((prev) => ({ ...defaultForm, courtId: resources[0]?.id || prev.courtId }));
    }
  }, [open, editingItem, resources]);

  useEffect(() => {
    if (!open) return;
    axiosClient.get('/users?limit=200')
      .then(({ data }) => setUsers(Array.isArray(data.users) ? data.users.filter((user) => String(user.role).toLowerCase() === 'user') : []))
      .catch(() => setUsers([]));
  }, [open]);

  const selectedUser = useMemo(() => users.find((user) => user._id === form.customerId), [users, form.customerId]);

  useEffect(() => {
    if (!selectedUser) return;
    setForm((prev) => ({
      ...prev,
      customerName: selectedUser.fullName || '',
      customerPhone: selectedUser.phone || ''
    }));
  }, [selectedUser]);

  if (!open) return null;

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setCheckResult(null);
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((item) => item !== day)
        : [...prev.daysOfWeek, day].sort()
    }));
    setCheckResult(null);
  };

  const payload = {
    customerId: form.customerId || undefined,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    courtId: form.courtId,
    startDate: form.startDate,
    endDate: form.endDate,
    daysOfWeek: form.daysOfWeek,
    startTime: form.startTime,
    endTime: form.endTime,
    note: form.note,
    paymentStatus: form.paymentStatus,
    createOnlyAvailableSlots: form.createOnlyAvailableSlots
  };

  const checkSlots = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await axiosClient.post('/admin/recurring-bookings/check', payload);
      setCheckResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể kiểm tra lịch cố định');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = editingItem
        ? `/admin/recurring-bookings/${editingItem._id}/update-future`
        : '/admin/recurring-bookings';
      const body = editingItem
        ? {
          newCourtId: form.courtId,
          newStartDate: form.startDate,
          newEndDate: form.endDate,
          newDaysOfWeek: form.daysOfWeek,
          newStartTime: form.startTime,
          newEndTime: form.endTime,
          reason: form.note
        }
        : payload;
      const { data } = editingItem
        ? await axiosClient.patch(endpoint, body)
        : await axiosClient.post(endpoint, body);
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tạo lịch cố định');
      if (err.response?.data?.conflictSlots) {
        setCheckResult({
          totalSlots: err.response.data.conflictSlots.length,
          availableSlots: 0,
          conflictSlots: err.response.data.conflictSlots.length,
          slots: err.response.data.conflictSlots
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const hasConflict = checkResult?.conflictSlots > 0;
  const canCreate = !hasConflict || form.createOnlyAvailableSlots || editingItem;

  return (
    <div className="schedule-manager-modal-backdrop">
      <section className="schedule-manager-modal schedule-manager-recurring-modal">
        <header>
          <div>
            <p>{editingItem ? 'Chỉnh sửa hiện tại' : 'Đặt lịch cố định'}</p>
            <h3>Lịch sân theo tuần/tháng</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>

        {error && <div className="schedule-manager-alert">{error}</div>}

        <div className="schedule-manager-form-grid">
          <label>
            <span>Khách hàng</span>
            <select value={form.customerId} onChange={(event) => updateForm('customerId', event.target.value)}>
              <option value="">Khách vãng lai</option>
              {users.map((user) => <option key={user._id} value={user._id}>{user.fullName} - {user.phone || user.email}</option>)}
            </select>
          </label>
          <label>
            <span>Tên khách hàng</span>
            <input value={form.customerName} onChange={(event) => updateForm('customerName', event.target.value)} />
          </label>
          <label>
            <span>Số điện thoại</span>
            <input value={form.customerPhone} onChange={(event) => updateForm('customerPhone', event.target.value)} />
          </label>
          <label>
            <span>Sân</span>
            <select value={form.courtId} onChange={(event) => updateForm('courtId', event.target.value)}>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
            </select>
          </label>
          <label>
            <span>Từ ngày</span>
            <VietnameseDateInput value={form.startDate} onChange={(value) => updateForm('startDate', value)} />
          </label>
          <label>
            <span>Đến ngày</span>
            <VietnameseDateInput value={form.endDate} onChange={(value) => updateForm('endDate', value)} />
          </label>
          <label>
            <span>Giờ bắt đầu</span>
            <select value={form.startTime} onChange={(event) => updateForm('startTime', event.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>
            <span>Giờ kết thúc</span>
            <select value={form.endTime} onChange={(event) => updateForm('endTime', event.target.value)}>
              {timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>
            <span>Thanh toán</span>
            <select value={form.paymentStatus} onChange={(event) => updateForm('paymentStatus', event.target.value)}>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="deposit">Đã đặt cọc</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </label>
        </div>

        <div className="schedule-manager-weekdays">
          {weekDays.map((day) => (
            <button
              type="button"
              key={day.value}
              className={form.daysOfWeek.includes(day.value) ? 'is-active' : ''}
              onClick={() => toggleDay(day.value)}
            >
              {day.label}
            </button>
          ))}
        </div>

        <label className="schedule-manager-field">
          <span>Ghi chú / lý do</span>
          <textarea value={form.note} rows={3} onChange={(event) => updateForm('note', event.target.value)} />
        </label>

        {!editingItem && (
          <label className="schedule-manager-checkbox">
            <input
              type="checkbox"
              checked={form.createOnlyAvailableSlots}
              onChange={(event) => updateForm('createOnlyAvailableSlots', event.target.checked)}
            />
            Chỉ tạo các buổi còn trống nếu có lịch bị trùng
          </label>
        )}

        <RecurringBookingCheckResult result={checkResult} />

        <footer>
          <button type="button" className="schedule-manager-btn schedule-manager-btn-light" onClick={checkSlots} disabled={loading}>
            {loading ? 'Đang kiểm tra...' : 'Kiểm tra lịch trống'}
          </button>
          <button type="button" className="schedule-manager-btn schedule-manager-btn-primary" onClick={submit} disabled={loading || !canCreate}>
            {loading ? 'Đang lưu...' : (editingItem ? 'Cập nhật lịch' : 'Tạo lịch cố định')}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default RecurringBookingModal;
