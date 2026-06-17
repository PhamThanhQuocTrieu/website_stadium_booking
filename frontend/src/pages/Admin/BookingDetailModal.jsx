import React from 'react';
import { X } from 'lucide-react';

const money = (value) => Number(value || 0).toLocaleString('vi-VN');

const BookingDetailModal = ({ booking, onClose }) => {
  if (!booking) return null;
  const props = booking.extendedProps || {};

  return (
    <div className="schedule-manager-modal-backdrop">
      <section className="schedule-manager-modal schedule-manager-detail-modal">
        <header>
          <div>
            <p>Chi tiết đơn đặt sân</p>
            <h3>{props.customerName || booking.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Dong"><X size={20} /></button>
        </header>
        <div className="schedule-manager-detail-grid">
          <span>Mã đơn</span><strong>{booking.id}</strong>
          <span>Số điện thoại</span><strong>{props.customerPhone || 'Chưa có'}</strong>
          <span>ân</span><strong>{props.fieldName || booking.getResources?.()[0]?.title || booking.resourceId}</strong>
          <span>Ngày</span><strong>{booking.start?.toLocaleDateString('vi-VN')}</strong>
          <span>Giờ</span><strong>{booking.start?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {booking.end?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
          <span> Tổng tiền</span><strong>{money(props.totalPrice)} d</strong>
          <span>Trạng thái đơn</span><strong className={`schedule-manager-pill status-${props.status}`}>{props.status}</strong>
          <span>Thanh toán</span><strong>{props.paymentStatus || 'Chưa cập nhật'}</strong>
        </div>
        {props.isRecurring && (
          <div className="schedule-manager-recurring-note">
            <strong>ịch có định</strong>
            <span>Nhóm lịch: {props.recurringGroupId}</span>
          </div>
        )}
        <div className="schedule-manager-history">
          <h4>lịch sử đổi lịch</h4>
          {(props.rescheduleHistory || []).length === 0 ? (
            <p>Chưa có lịch sử thay đổi.</p>
          ) : (
            props.rescheduleHistory.map((item, index) => (
              <div key={`${item.changedAt}-${index}`}>
                <strong>{item.oldStartTime} - {item.oldEndTime}</strong>
                <span>chuyen sang {item.newStartTime} - {item.newEndTime} ngày {item.newDate}</span>
                {item.reason && <small>{item.reason}</small>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default BookingDetailModal;
