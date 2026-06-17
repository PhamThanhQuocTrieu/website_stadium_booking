import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import Swal from 'sweetalert2';
import { CalendarRange } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import socket, { joinSocketRoom } from '../../socket';
import ScheduleFilter from './ScheduleFilter';
import BookingDetailModal from './BookingDetailModal';
import RescheduleConfirmModal from './RescheduleConfirmModal';
import RecurringBookingModal from './RecurringBookingModal';
import RecurringBookingList from './RecurringBookingList';
import '../../styles/admin/schedule-manager.css';

const today = new Date().toISOString().slice(0, 10);
const lockedStatuses = ['cancelled', 'completed', 'Cancelled', 'Completed', 'CANCELLED', 'COMPLETED'];

const formatDate = (date) => date?.toISOString().slice(0, 10);
const formatTime = (date) => date?.toTimeString().slice(0, 5);
const formatSlotLabel = (slotInfo) => {
  const hour = slotInfo.date.getHours();
  const minute = slotInfo.date.getMinutes();
  const label = hour === 0 && minute === 0
    ? '24:00'
    : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <div className="schedule-manager-slot-label">
      <span>{label}</span>
    </div>
  );
};

const statusClassNames = (event) => {
  const status = event.extendedProps?.status || '';
  const classes = [`schedule-event-${String(status).toLowerCase()}`];
  if (event.extendedProps?.isRecurring) classes.push('schedule-event-recurring');
  if (lockedStatuses.includes(status)) classes.push('schedule-event-locked');
  return classes;
};

const ScheduleManager = () => {
  const calendarRef = useRef(null);
  const [filters, setFilters] = useState({ date: today, sportType: 'all', search: '' });
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [recurringItems, setRecurringItems] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('userInfo'));
    } catch {
      return null;
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/admin/schedule', { params: filters });
      setResources(data.resources || []);
      setEvents(data.events || []);
    } catch (error) {
      Swal.fire('Khong the tai lich san', error.response?.data?.message || error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchRecurring = useCallback(async () => {
    try {
      const { data } = await axiosClient.get('/admin/recurring-bookings');
      setRecurringItems(data.recurringBookings || []);
    } catch (error) {
      console.error('Khong the tai lich co dinh', error);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
    fetchRecurring();
  }, [fetchSchedule, fetchRecurring]);

  useEffect(() => {
    joinSocketRoom(currentUser);
    const refetch = () => {
      fetchSchedule();
      fetchRecurring();
    };
    socket.on('schedule:refresh', refetch);
    socket.on('booking:updated', refetch);
    socket.on('booking:rescheduled', refetch);
    socket.on('booking:recurring-created', refetch);
    return () => {
      socket.off('schedule:refresh', refetch);
      socket.off('booking:updated', refetch);
      socket.off('booking:rescheduled', refetch);
      socket.off('booking:recurring-created', refetch);
    };
  }, [currentUser, fetchSchedule, fetchRecurring]);

  const moveCalendarDate = (date) => {
    setFilters((prev) => ({ ...prev, date }));
    calendarRef.current?.getApi()?.gotoDate(date);
  };

  const eventAllow = (_, draggedEvent) => !lockedStatuses.includes(draggedEvent?.extendedProps?.status);

  const captureChange = (info) => {
    const oldResource = info.oldResource || info.event.getResources?.()[0];
    const newResource = info.newResource || info.event.getResources?.()[0];
    setPendingChange({
      event: info.event,
      revert: info.revert,
      oldStart: info.oldEvent?.start || info.oldStart,
      oldEnd: info.oldEvent?.end || info.oldEnd,
      oldResourceTitle: oldResource?.title,
      newResourceTitle: newResource?.title
    });
  };

  const cancelChange = () => {
    pendingChange?.revert?.();
    setPendingChange(null);
  };

  const confirmChange = async (reason) => {
    if (!pendingChange) return;
    const resource = pendingChange.event.getResources?.()[0];
    try {
      setSaving(true);
      await axiosClient.patch(`/admin/bookings/${pendingChange.event.id}/reschedule`, {
        newCourtId: resource?.id,
        newDate: formatDate(pendingChange.event.start),
        newStartTime: formatTime(pendingChange.event.start),
        newEndTime: formatTime(pendingChange.event.end),
        reason
      });
      setPendingChange(null);
      Swal.fire('Thanh cong', 'Lich san da duoc cap nhat', 'success');
      fetchSchedule();
    } catch (error) {
      pendingChange.revert?.();
      Swal.fire('Khong the doi lich', error.response?.data?.message || error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderEventContent = (eventInfo) => {
    const props = eventInfo.event.extendedProps || {};
    return (
      <div className="schedule-manager-event-card">
        <strong>{props.customerName || eventInfo.event.title}</strong>
        <span>{formatTime(eventInfo.event.start)} - {formatTime(eventInfo.event.end)}</span>
        <small>{props.status}</small>
        {props.isRecurring && <em>Cố định</em>}
      </div>
    );
  };

  const renderResourceLabel = (resourceInfo) => {
    const resource = resourceInfo.resource;
    const title = resource.title || resource.extendedProps?.fieldName || 'Sân';
    const sportType = resource.extendedProps?.sportType || 'Sân thể thao';
    const image = resource.extendedProps?.image || resource.extendedProps?.gallery?.[0];
    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();

    return (
      <div className="schedule-manager-resource-label">
        {image ? (
          <img className="schedule-manager-resource-image" src={image} alt={title} />
        ) : (
          <span className="schedule-manager-resource-avatar">{initials || 'S'}</span>
        )}
        <div>
          <strong>{title}</strong>
          <small>{sportType}</small>
        </div>
      </div>
    );
  };

  const handleRecurringCreated = (result) => {
    Swal.fire('Thanh cong', result.message || `Da tao ${result.createdCount || 0} buoi`, 'success');
    fetchSchedule();
    fetchRecurring();
  };

  const cancelRecurring = async (item) => {
    const result = await Swal.fire({
      title: 'Hủy lịch có định?',
      input: 'textarea',
      inputLabel: 'Lý do hủy',
      showCancelButton: true,
      confirmButtonText: 'Hủy lịch',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;
    try {
      await axiosClient.patch(`/admin/recurring-bookings/${item._id}/cancel`, { reason: result.value || '' });
      Swal.fire('Đã hủy', 'Lịch có định đã được hủy', 'success');
      fetchSchedule();
      fetchRecurring();
    } catch (error) {
      Swal.fire('Khong the huy', error.response?.data?.message || error.message, 'error');
    }
  };

  return (
    <div className="schedule-manager-page">
      <div className="schedule-manager-heading">
        <div className="schedule-manager-heading-icon"><CalendarRange size={24} /></div>
        <div>
          <h1>Quản lý lịch sân</h1>
          <p>Theo dõi, điều chỉnh và tạo lịch đặt sân có định</p>
        </div>
      </div>

      <ScheduleFilter
        filters={filters}
        onChange={(nextFilters) => {
          setFilters(nextFilters);
          if (nextFilters.date !== filters.date) moveCalendarDate(nextFilters.date);
        }}
        onRefresh={() => {
          fetchSchedule();
          fetchRecurring();
        }}
        onOpenRecurring={() => {
          setEditingRecurring(null);
          setRecurringOpen(true);
        }}
      />

      <section className="schedule-manager-calendar-shell">
        {loading && <div className="schedule-manager-loading">Đang tải lịch sân...</div>}
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineDay"
          initialDate={filters.date}
          schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
          resourceAreaHeaderContent="Danh sách sân"
          resourceAreaWidth="300px"
          resourceLabelContent={renderResourceLabel}
          resources={resources}
          events={events}
          slotMinTime="05:00:00"
          slotMaxTime="24:30:00"
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          slotMinWidth={76}
          slotLabelContent={formatSlotLabel}
          height="auto"
          editable
          eventResourceEditable
          eventDurationEditable
          selectable={false}
          eventAllow={eventAllow}
          eventClassNames={({ event }) => statusClassNames(event)}
          eventContent={renderEventContent}
          eventClick={(info) => setSelectedBooking(info.event)}
          eventDrop={captureChange}
          eventResize={captureChange}
          headerToolbar={false}
          nowIndicator
        />
      </section>

      <div className="schedule-manager-legend">
        <span className="pending">Chờ xác nhận</span>
        <span className="confirmed">Đã xác nhận</span>
        <span className="paid">Đã thanh toán</span>
        <span className="cancel_requested">Yêu cầu hủy</span>
        <span className="cancelled">Đã hủy</span>
        <span className="completed">Đã hoàn thành</span>
        <span className="recurring">Lịch có định</span>
      </div>

      <RecurringBookingList
        items={recurringItems}
        onCancel={cancelRecurring}
        onEdit={(item) => {
          setEditingRecurring(item);
          setRecurringOpen(true);
        }}
      />

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      <RescheduleConfirmModal change={pendingChange} onConfirm={confirmChange} onCancel={cancelChange} loading={saving} />
      <RecurringBookingModal
        open={recurringOpen}
        resources={resources}
        editingItem={editingRecurring}
        onClose={() => {
          setRecurringOpen(false);
          setEditingRecurring(null);
        }}
        onCreated={handleRecurringCreated}
      />
    </div>
  );
};

export default ScheduleManager;
