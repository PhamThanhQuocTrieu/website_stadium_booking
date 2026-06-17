import React from 'react';
import { Calendar, RefreshCw, Search, Repeat } from 'lucide-react';

const ScheduleFilter = ({ filters, onChange, onRefresh, onOpenRecurring }) => {
  const updateFilter = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="schedule-manager-filter">
      <label>
        <span>Ngày</span>
        <div className="schedule-manager-input-icon">
          <Calendar size={16} />
          <input
            type="date"
            value={filters.date}
            onChange={(event) => updateFilter('date', event.target.value)}
          />
        </div>
      </label>

      <label>
        <span>Loại sân</span>
        <select value={filters.sportType} onChange={(event) => updateFilter('sportType', event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="Bóng đá">Bóng đá</option>
          <option value="Cầu lông">Cầu lông</option>
          <option value="Tennis">Tennis</option>
          <option value="Pickleball">Pickleball</option>
        </select>
      </label>

      <label className="schedule-manager-search">
        <span>Tìm kiếm</span>
        <div className="schedule-manager-input-icon">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            placeholder="Tên khách, SĐT, mã đơn..."
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </div>
      </label>

      <button type="button" className="schedule-manager-btn schedule-manager-btn-light" onClick={onRefresh}>
        <RefreshCw size={17} />
        Làm mới
      </button>
      <button type="button" className="schedule-manager-btn schedule-manager-btn-primary" onClick={onOpenRecurring}>
        <Repeat size={17} />
        Đặt lịch có định
      </button>
    </div>
  );
};

export default ScheduleFilter;
