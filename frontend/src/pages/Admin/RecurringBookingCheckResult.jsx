import React from 'react';

const dayNames = ['Chu nhat', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7'];

const RecurringBookingCheckResult = ({ result }) => {
  if (!result) return null;
  return (
    <div className="schedule-manager-check-result">
      <div className="schedule-manager-check-stats">
        <span>Tổng buổi <strong>{result.totalSlots}</strong></span>
        <span>Còn trống <strong>{result.availableSlots}</strong></span>
        <span>Bị trùng <strong>{result.conflictSlots}</strong></span>
      </div>
      <div className="schedule-manager-slot-list">
        {(result.slots || []).map((slot) => (
          <div key={`${slot.date}-${slot.startTime}`} className={slot.isAvailable ? 'is-free' : 'is-conflict'}>
            <strong>{slot.date}</strong>
            <span>{dayNames[slot.dayOfWeek]} | {slot.startTime} - {slot.endTime}</span>
            <small>{slot.isAvailable ? 'Trong' : `Trung lich ${slot.conflictCustomerName || ''}`}</small>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecurringBookingCheckResult;
