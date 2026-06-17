import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import RecurringBookingCheckResult from './RecurringBookingCheckResult';

const defaultForm = {
  customerId: '',
  customerName: '',
  customerPhone: '',
  courtId: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  daysOfWeek: [2, 4],
  startTime: '17:00',
  endTime: '18:00',
  note: '',
  paymentStatus: 'unpaid',
  createOnlyAvailableSlots: false
};

const weekDays = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' }
];

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
      setError(err.response?.data?.message || 'Không thể kiểm tra lịch có định');
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
      setError(err.response?.data?.message || 'Không thể tạo lịch có định');
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
            <p>{editingItem ? 'Chỉnh sửa hiện tại' : 'Đặt lịch có định'}</p>
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
            <input type="date" value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} />
          </label>
          <label>
            <span>Đến ngày</span>
            <input type="date" value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} />
          </label>
          <label>
            <span>Giờ bắt đầu</span>
            <input type="time" step="1800" value={form.startTime} onChange={(event) => updateForm('startTime', event.target.value)} />
          </label>
          <label>
            <span>Giờ kết thúc</span>
            <input type="time" step="1800" value={form.endTime} onChange={(event) => updateForm('endTime', event.target.value)} />
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
            {loading ? 'Dang kiem tra...' : 'Kiem tra lich trong'}
          </button>
          <button type="button" className="schedule-manager-btn schedule-manager-btn-primary" onClick={submit} disabled={loading || !canCreate}>
            {loading ? 'Dang luu...' : (editingItem ? 'Cap nhat lich' : 'Tao lich co dinh')}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default RecurringBookingModal;
