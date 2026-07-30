import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import '../../styles/admin/calendar.css';

const BookingCalendar = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  return (
    <div className="admin-calendar bg-white p-4 rounded-4 shadow-sm border">
      <div className="admin-calendar-header d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold mb-0">Lịch biểu tương tác thời gian thực</h3>
      </div>
      <div className="admin-calendar-scroll">
        <FullCalendar
          plugins={[resourceTimeGridPlugin, interactionPlugin]}
          initialView="resourceTimeGridDay"
          resources={[
            { id: 'a', title: 'Sân 5 - Số 1' },
            { id: 'b', title: 'Sân 5 - Số 2' },
            { id: 'c', title: 'Sân Pickleball' },
          ]}
          editable
          droppable
          selectable
          slotMinTime="05:00:00"
          slotMaxTime="22:00:00"
          height={isMobile ? 620 : 'auto'}
          resourceAreaWidth={isMobile ? '120px' : '180px'}
          headerToolbar={isMobile
            ? {
                left: 'prev,next',
                center: 'title',
                right: 'today'
              }
            : {
                left: 'prev,next today',
                center: 'title',
                right: 'resourceTimeGridDay,resourceTimeGridWeek'
              }}
          eventClick={(info) => alert('Thông tin Booking ID: ' + info.event.id)}
          eventDrop={(info) => {
            console.log('Đã đổi sang sân:', info.event.getResources()[0].id);
            console.log('Giờ mới:', info.event.start);
          }}
        />
      </div>
    </div>
  );
};

export default BookingCalendar;
