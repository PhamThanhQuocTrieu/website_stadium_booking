import React, { useState } from 'react';
import { X } from 'lucide-react';

const toTime = (date) => date?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const toDate = (date) => date?.toLocaleDateString('vi-VN');

const RescheduleConfirmModal = ({ change, onConfirm, onCancel, loading }) => {
  const [reason, setReason] = useState('');
  if (!change) return null;
  const props = change.event.extendedProps || {};

  return (
    <div className="schedule-manager-modal-backdrop">
      <section className="schedule-manager-modal">
        <header>
          <div>
            <p>Xác nhận đổi lịch</p>
            <h3>{props.customerName || change.event.title}</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Đóng"><X size={20} /></button>
        </header>
        <div className="schedule-manager-compare">
          <div>
            <span>Lịch cũ</span>
            <strong>{change.oldResourceTitle || props.fieldName || 'Sân cũ'}</strong>
            <small>{toDate(change.oldStart)} | {toTime(change.oldStart)} - {toTime(change.oldEnd)}</small>
          </div>
          <div>
            <span>Lịch mới</span>
            <strong>{change.newResourceTitle || 'Sân mới'}</strong>
            <small>{toDate(change.event.start)} | {toTime(change.event.start)} - {toTime(change.event.end)}</small>
          </div>
        </div>
        <label className="schedule-manager-field">
          <span>Lý do thay đổi</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>
        <footer>
          <button type="button" className="schedule-manager-btn schedule-manager-btn-light" onClick={onCancel}>Hủy</button>
          <button
            type="button"
            className="schedule-manager-btn schedule-manager-btn-primary"
            onClick={() => onConfirm(reason)}
            disabled={loading}
          >
            {loading ? 'Dang luu...' : 'Xac nhan'}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default RescheduleConfirmModal;
