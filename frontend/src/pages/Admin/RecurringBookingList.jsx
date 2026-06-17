import React from 'react';
import { Eye, Pencil, XCircle } from 'lucide-react';

const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const RecurringBookingList = ({ items, onCancel, onEdit }) => (
  <section className="schedule-manager-recurring-list">
    <header>
      <div>
        <p>Danh sách lịch có định</p>
        <h3>Quản lý các nhóm lịch lặp lại</h3>
      </div>
    </header>
    <div className="schedule-manager-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th>San</th>
            <th>Thu trong tuần</th>
            <th>Giờ</th>
            <th>Từ ngày - đến ngày</th>
            <th>Số buổi</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan="8" className="schedule-manager-empty-row">Chưa có lịch có định.</td></tr>
          ) : items.map((item) => (
            <tr key={item._id}>
              <td>
                <strong>{item.customerName || item.customer?.fullName || 'Khách hàng'}</strong>
                <span>{item.customerPhone || item.customer?.phone || ''}</span>
              </td>
              <td>{item.court?.fieldName || 'San'}</td>
              <td>{(item.daysOfWeek || []).map((day) => dayNames[day]).join(', ')}</td>
              <td>{item.startTime} - {item.endTime}</td>
              <td>{item.startDate} - {item.endDate}</td>
              <td>{item.bookingIds?.length || 0}</td>
              <td><span className={`schedule-manager-pill status-${item.status}`}>{item.status}</span></td>
              <td>
                <div className="schedule-manager-actions">
                  <button type="button" title="Xem chi tiet"><Eye size={16} /></button>
                  <button type="button" title="Chinh sua lich tuong lai" onClick={() => onEdit(item)}><Pencil size={16} /></button>
                  <button type="button" title="Huy lich co dinh" onClick={() => onCancel(item)}><XCircle size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default RecurringBookingList;
