import React, { useState, useEffect, useCallback } from 'react';
import { Container, Button, Modal, Spinner } from 'react-bootstrap';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar3, ChevronLeft, ChevronRight } from 'react-bootstrap-icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import '../styles/BookingPage.css';
import PricingModal from './PricingModal';
import { getRulePrice, normalizeTime } from '../utils/pricing';

const socket = io('http://localhost:5000');

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN');
const DEFAULT_OPEN_TIME = '05:00';
const DEFAULT_CLOSE_TIME = '24:00';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const timeToMinutesValue = (time) => {
    const [hour = 0, minute = 0] = normalizeTime(time).split(':').map(Number);
    return hour * 60 + minute;
};

const minutesToDisplayTime = (totalMinutes) => {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${hour}:${String(minute).padStart(2, '0')}`;
};

const getScheduleRange = (rules = []) => {
    const validRules = rules.filter(rule => rule?.startTime && rule?.endTime);
    if (!validRules.length) {
        return { start: DEFAULT_OPEN_TIME, end: DEFAULT_CLOSE_TIME };
    }

    const start = Math.min(...validRules.map(rule => timeToMinutesValue(rule.startTime)));
    let end = Math.max(...validRules.map(rule => timeToMinutesValue(rule.endTime)));

    if (end <= start) end = timeToMinutesValue(DEFAULT_CLOSE_TIME);

    return {
        start: minutesToDisplayTime(start),
        end: minutesToDisplayTime(end)
    };
};

const buildBookableSlots = (startTime, endTime) => {
    const start = timeToMinutesValue(startTime);
    const end = timeToMinutesValue(endTime);
    const slots = [];

    for (let current = start; current < end; current += 30) {
        slots.push(minutesToDisplayTime(current));
    }

    return slots.length ? slots : buildBookableSlots(DEFAULT_OPEN_TIME, DEFAULT_CLOSE_TIME);
};

const addMinutesToTime = (time, minutesToAdd) => {
    const [hour = 0, minute = 0] = normalizeTime(time).split(':').map(Number);
    const totalMinutes = hour * 60 + minute + minutesToAdd;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
};

const buildSlotRange = (startTime, endTime) => {
    const slots = [];
    let current = normalizeTime(startTime);
    const end = normalizeTime(endTime);

    while (timeToMinutesValue(current) < timeToMinutesValue(end)) {
        slots.push(current);
        current = addMinutesToTime(current, 30);
    }

    return slots;
};

const sortSlotsByTime = (slots = []) => {
    return [...new Set(slots.map(normalizeTime))]
        .sort((a, b) => timeToMinutesValue(a) - timeToMinutesValue(b));
};

const areSlotsContiguous = (slots = []) => {
    const sortedSlots = sortSlotsByTime(slots);
    return sortedSlots.every((slot, index) => (
        index === 0 || timeToMinutesValue(slot) - timeToMinutesValue(sortedSlots[index - 1]) === 30
    ));
};

const normalizeStatusText = (value) => String(value || '').trim().toLowerCase();
const isPendingPaymentBooking = (booking) => {
    const bookingStatus = normalizeStatusText(booking?.status);
    const paymentStatus = normalizeStatusText(booking?.paymentStatus);
    const isHolding = bookingStatus === 'pending_payment' || ['pending', 'unpaid'].includes(paymentStatus);
    if (!isHolding) return false;
    return !booking?.holdExpiresAt || new Date(booking.holdExpiresAt) > new Date();
};

const BookingPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fieldData, setFieldData] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [slotStatusMap, setSlotStatusMap] = useState({});
    const [waitlistedSlotMap, setWaitlistedSlotMap] = useState({});
    const [myHeldSlotMap, setMyHeldSlotMap] = useState({});
    const [pricingRules, setPricingRules] = useState([]);

    const scheduleRange = React.useMemo(() => getScheduleRange(pricingRules), [pricingRules]);
    const bookableSlots = React.useMemo(() => buildBookableSlots(scheduleRange.start, scheduleRange.end), [scheduleRange]);
    const timeHeaders = bookableSlots;

    const formatDateStr = useCallback((dateObj) => {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const fetchBookingStatus = useCallback(async () => {
        if (!id || id === 'undefined') {
            setIsLoading(false);
            return;
        }
        try {
            const dateStr = formatDateStr(selectedDate);
            const token = localStorage.getItem('userToken');
            const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            const res = await axios.get(`http://localhost:5000/api/bookings/fields/${id}/booking-status?date=${dateStr}`, authHeaders);
            setFieldData(res.data.field);
            setBookedSlots((res.data.bookedSlots || []).map(normalizeTime));
            const nextSlotStatusMap = {};
            Object.entries(res.data.slotStatuses || {}).forEach(([slot, status]) => {
                nextSlotStatusMap[normalizeTime(slot)] = status;
            });
            setSlotStatusMap(nextSlotStatusMap);
            setPricingRules(res.data.field?.pricingRules || []);

            const myHeldSlotsFromTimeline = {};
            Object.entries(res.data.slotBookings || {}).forEach(([slot, booking]) => {
                if (!booking?.isMine || booking.slotStatus !== 'held') return;
                myHeldSlotsFromTimeline[normalizeTime(slot)] = {
                    bookingId: booking.bookingId,
                    totalAmount: booking.totalAmount,
                    startTime: normalizeTime(booking.startTime),
                    endTime: normalizeTime(booking.endTime)
                };
            });

            if (token) {
                try {
                    const [waitlistRes, myBookingsRes] = await Promise.all([
                        axios.get(`http://localhost:5000/api/bookings/waitlist?fieldId=${id}&date=${dateStr}`, authHeaders),
                        axios.get('http://localhost:5000/api/bookings/my-bookings', authHeaders)
                    ]);
                    const nextWaitlistedSlotMap = {};
                    (waitlistRes.data.waitlist || []).forEach((item) => {
                        const waitlistRange = {
                            startTime: normalizeTime(item.startTime),
                            endTime: normalizeTime(item.endTime)
                        };
                        buildSlotRange(waitlistRange.startTime, waitlistRange.endTime).forEach((slot) => {
                            nextWaitlistedSlotMap[slot] = waitlistRange;
                        });
                    });
                    setWaitlistedSlotMap(nextWaitlistedSlotMap);

                    const nextMyHeldSlotMap = { ...myHeldSlotsFromTimeline };
                    (myBookingsRes.data || []).forEach((booking) => {
                        const bookingField = booking.fieldId || booking.field;
                        const bookingFieldId = bookingField?._id || bookingField;
                        if (String(bookingFieldId) !== String(id)) return;
                        if (String(booking.date).trim() !== dateStr) return;
                        if (!isPendingPaymentBooking(booking)) return;

                        const holdInfo = {
                            bookingId: booking._id,
                            totalAmount: booking.finalAmount || booking.totalPrice,
                            startTime: normalizeTime(booking.startTime),
                            endTime: normalizeTime(booking.endTime)
                        };
                        buildSlotRange(holdInfo.startTime, holdInfo.endTime).forEach((slot) => {
                            nextMyHeldSlotMap[slot] = holdInfo;
                        });
                    });
                    setMyHeldSlotMap(nextMyHeldSlotMap);
                } catch (waitlistErr) {
                    console.error('Lỗi đồng bộ dữ liệu cá nhân:', waitlistErr);
                    setWaitlistedSlotMap({});
                    setMyHeldSlotMap(myHeldSlotsFromTimeline);
                }
            } else {
                setWaitlistedSlotMap({});
                setMyHeldSlotMap({});
            }
            setIsLoading(false);
        } catch (err) {
            console.error("Lỗi đồng bộ:", err);
            setIsLoading(false);
        }
    }, [id, selectedDate, formatDateStr]);

    useEffect(() => {
        fetchBookingStatus();
        const handleSlotBooked = (data) => {
            if (data.fieldId === id && data.date === formatDateStr(selectedDate)) {
                const normalizedSlots = (data.slots || []).map(normalizeTime);
                setBookedSlots(prev => [...new Set([...prev, ...normalizedSlots])]);
                setSlotStatusMap(prev => {
                    const next = { ...prev };
                    normalizedSlots.forEach(slot => {
                        next[slot] = data.slotStatus || 'held';
                    });
                    return next;
                });
                fetchBookingStatus();
                setSelectedSlots(prev => prev.filter(slot => !normalizedSlots.includes(normalizeTime(slot))));
            }
        };
        const handleBookingChanged = (data = {}) => {
            const eventFieldId = data.fieldId ? String(data.fieldId) : id;
            const eventDate = data.date || formatDateStr(selectedDate);
            if (eventFieldId === id && eventDate === formatDateStr(selectedDate)) {
                fetchBookingStatus();
            }
        };
        socket.on('slot_booked_success', handleSlotBooked);
        socket.on('booking_cancelled', handleBookingChanged);
        socket.on('booking_cancel_requested', handleBookingChanged);
        return () => {
            socket.off('slot_booked_success', handleSlotBooked);
            socket.off('booking_cancelled', handleBookingChanged);
            socket.off('booking_cancel_requested', handleBookingChanged);
        };
    }, [id, selectedDate, fetchBookingStatus, formatDateStr]);

    useEffect(() => {
        const refreshTimer = setInterval(() => {
            fetchBookingStatus();
        }, 15000);

        return () => clearInterval(refreshTimer);
    }, [fetchBookingStatus]);

    const calculateTotalAmount = (slots = selectedSlots) => {
        return slots.reduce((total, slotTime) => {
            return total + (getRulePrice(pricingRules, selectedDate, slotTime) / 2);
        }, 0);
    };

    const triggerAlert = (msg) => {
        setAlertMessage(msg);
        setTimeout(() => setAlertMessage(''), 2500);
    };

    const getSlotStatus = (time) => {
        if (fieldData?.status === 'Maintenance') return 'locked';
        const timelineStatus = slotStatusMap[normalizeTime(time)];
        if (timelineStatus) return timelineStatus;
        if (bookedSlots.includes(normalizeTime(time))) return 'held';
        const [hour, minute] = time.split(':').map(Number);
        const now = new Date();
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);
        if (slotTime <= now) return 'locked';
        return 'available';
    };

    const showMyHeldPaymentPrompt = async (time) => {
        const holdInfo = myHeldSlotMap[normalizeTime(time)];
        if (!holdInfo) return;

        const result = await Swal.fire({
            title: 'Bạn đang trong quá trình thanh toán',
            html: `
                <div style="text-align:left">
                    <p>Khung giờ ${escapeHtml(holdInfo.startTime)} - ${escapeHtml(holdInfo.endTime)} đang được giữ chỗ cho bạn.</p>
                    <p>Vui lòng thanh toán ngay trước khi hết thời gian giữ chỗ.</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            cancelButtonText: 'Quay lại',
            confirmButtonText: 'Thanh toán ngay',
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            navigate('/payment', {
                state: {
                    bookingId: holdInfo.bookingId,
                    totalAmount: holdInfo.totalAmount
                }
            });
        }
    };

    const joinWaitlist = async (time) => {
        const normalizedTime = normalizeTime(time);
        const currentWaitlist = waitlistedSlotMap[normalizedTime];
        if (currentWaitlist) {
            Swal.fire({
                title: 'Bạn đã vào hàng chờ',
                html: `
                    <div style="text-align:left">
                        <p>Bạn đã vào hàng chờ khung giờ ${escapeHtml(currentWaitlist.startTime)} - ${escapeHtml(currentWaitlist.endTime)} rồi.</p>
                        <p>Hệ thống sẽ thông báo khi khung giờ này trống nhé.</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Đã hiểu',
                confirmButtonColor: '#198754'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Khung giờ đang được giữ chỗ',
            html: `
                <div style="text-align:left">
                    <p>Khung giờ ${escapeHtml(time)} đang được người khác giữ chỗ để thanh toán.</p>
                    <p>Nếu sau 3 phút người đó chưa thanh toán, hệ thống sẽ thông báo cho bạn để vào đặt lại khung giờ này.</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            cancelButtonText: 'Quay lại',
            confirmButtonText: 'Vào hàng chờ',
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('userToken');
            const res = await axios.post('http://localhost:5000/api/bookings/waitlist', {
                fieldId: id,
                date: formatDateStr(selectedDate),
                startTime: normalizedTime,
                endTime: addMinutesToTime(time, 30)
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.available) {
                await fetchBookingStatus();
                setWaitlistedSlotMap(prev => {
                    const next = { ...prev };
                    delete next[normalizedTime];
                    return next;
                });
                setSelectedSlots(prev => (
                    sortSlotsByTime(prev).includes(normalizedTime)
                        ? sortSlotsByTime(prev)
                        : sortSlotsByTime([...prev, normalizedTime])
                ));
                Swal.fire('Khung giờ đã trống', res.data.message || 'Bạn có thể tiếp tục đặt khung giờ này.', 'success');
                return;
            }

            if (res.data.waitlisted) {
                const waitlistRange = {
                    startTime: normalizeTime(res.data.startTime || normalizedTime),
                    endTime: normalizeTime(res.data.endTime || addMinutesToTime(time, 30))
                };
                setWaitlistedSlotMap(prev => {
                    const next = { ...prev };
                    buildSlotRange(waitlistRange.startTime, waitlistRange.endTime).forEach((slot) => {
                        next[slot] = waitlistRange;
                    });
                    return next;
                });
            }

            Swal.fire(
                res.data.alreadyWaitlisted ? 'Bạn đã vào hàng chờ' : 'Đã vào hàng chờ',
                res.data.message || 'Hệ thống sẽ thông báo khi khung giờ trống nhé.',
                res.data.alreadyWaitlisted ? 'info' : 'success'
            );
        } catch (err) {
            Swal.fire('Không thể vào hàng chờ', err.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
            fetchBookingStatus();
        }
    };

    const handleSlotClick = (time) => {
        const normalizedTime = normalizeTime(time);
        const status = getSlotStatus(time);
        if (fieldData?.status === 'Maintenance') { triggerAlert('Sân đang bảo trì, vui lòng chọn sân khác!'); return; }
        if (status === 'locked') { triggerAlert(`Khung giờ ${time} đã qua!`); return; }
        if (status === 'held') {
            if (myHeldSlotMap[normalizedTime]) {
                showMyHeldPaymentPrompt(time);
                return;
            }
            joinWaitlist(time);
            return;
        }
        if (status === 'booked') { triggerAlert(`Khung giờ ${time} đã được đặt!`); return; }
        setSelectedSlots(prev => {
            const normalizedPrev = sortSlotsByTime(prev);
            const isSelected = normalizedPrev.includes(normalizedTime);
            const nextSlots = isSelected
                ? normalizedPrev.filter(slot => slot !== normalizedTime)
                : sortSlotsByTime([...normalizedPrev, normalizedTime]);

            if (areSlotsContiguous(nextSlots)) return nextSlots;

            if (!isSelected) {
                Swal.fire(
                    'Chỉ chọn một khung giờ liên tục',
                    'Bạn vừa chọn một khung giờ rời khỏi đoạn đang chọn. Hệ thống sẽ bắt đầu lại từ khung giờ mới này.',
                    'info'
                );
                return [normalizedTime];
            }

            Swal.fire(
                'Không thể bỏ giữa khung giờ',
                'Bạn chỉ có thể bỏ chọn từ đầu hoặc cuối đoạn giờ đang chọn để tránh tạo khoảng trống ở giữa.',
                'warning'
            );
            return normalizedPrev;
        });
    };

    const handleProcessBooking = async (ignoreConflict = false) => {
        if (selectedSlots.length === 0 || (isSubmitting && !ignoreConflict)) return;
        const normalizedSelectedSlots = sortSlotsByTime(selectedSlots);
        if (!areSlotsContiguous(normalizedSelectedSlots)) {
            Swal.fire(
                'Khung giờ không liên tục',
                'Vui lòng chỉ chọn một đoạn thời gian liên tục trước khi thanh toán.',
                'warning'
            );
            setSelectedSlots(normalizedSelectedSlots);
            return;
        }
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('userToken');
            const res = await axios.post('http://localhost:5000/api/bookings/reserve', {
                fieldId: id,
                date: formatDateStr(selectedDate),
                slots: normalizedSelectedSlots,
                totalPrice: calculateTotalAmount(normalizedSelectedSlots),
                ...(ignoreConflict ? { ignoreConflict: true } : {})
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.warning) {
                const conflict = res.data.conflictBooking || {};
                setIsSubmitting(false);
                const result = await Swal.fire({
                    title: 'Trùng lịch đặt sân',
                    html: `
                        <div style="text-align:left">
                            <p>Bạn đã có một đơn đặt sân khác trong cùng khung giờ.</p>
                            <p><strong>Sân:</strong> ${escapeHtml(conflict.fieldName || 'Không rõ')}</p>
                            <p><strong>Thời gian:</strong> ${escapeHtml(conflict.startTime || '')} - ${escapeHtml(conflict.endTime || '')}</p>
                            <p>Bạn vẫn muốn tiếp tục đặt thêm sân?</p>
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    cancelButtonText: 'Quay lại',
                    confirmButtonText: 'Vẫn tiếp tục',
                    confirmButtonColor: '#198754',
                    cancelButtonColor: '#6c757d',
                    reverseButtons: true
                });

                if (result.isConfirmed) {
                    await handleProcessBooking(true);
                }
                return;
            }
            if (res.data.success) {
                const normalizedSlots = normalizedSelectedSlots.map(normalizeTime);
                setBookedSlots(prev => [...new Set([...prev, ...normalizedSlots])]);
                setSelectedSlots([]);
                navigate('/payment', { state: { bookingId: res.data.bookingId, totalAmount: res.data.totalPrice ?? calculateTotalAmount() } });
            }
        } catch (err) {
            triggerAlert(err.response?.data?.message || "Lỗi đặt sân!");
            fetchBookingStatus();
            setSelectedSlots([]);
        } finally { setIsSubmitting(false); }
    };

    const renderCalendarDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < startOffset; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        for (let d = 1; d <= totalDays; d++) {
            const dayToCheck = new Date(year, month, d);
            const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
            const isPastDay = dayToCheck < today;
            days.push(
                <div key={d} className={`day-cell ${isSelected ? 'active' : ''} ${isPastDay ? 'text-muted' : ''}`}
                    onClick={() => { if (!isPastDay) { setSelectedDate(new Date(year, month, d)); setIsLoading(true); setShowDatePicker(false); } }}
                    style={{ cursor: isPastDay ? 'not-allowed' : 'pointer' }}>
                    {d}
                </div>
            );
        }
        return days;
    };

    if (isLoading || !fieldData) return <div className="vh-100 bg-white d-flex flex-column justify-content-center align-items-center"><Spinner animation="border" variant="success" /></div>;

    return (
        <div className="booking-page-premium">
            <AnimatePresence>
                {alertMessage && (
                    <Motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="custom-toast">
                        {alertMessage}
                    </Motion.div>
                )}
            </AnimatePresence>

            <header className="booking-nav-premium">
                <Container className="d-flex align-items-center justify-content-between">
                    <Button variant="link" className="text-white p-0" onClick={() => navigate(-1)}><ArrowLeft size={24} /></Button>
                    <h5 className="fw-bold mb-0" style={{ color: '#ffffff' }}>Đặt lịch - {fieldData.fieldName}</h5>
                    <div className="date-pill-v3 d-flex align-items-center gap-2" onClick={() => setShowDatePicker(true)}>
                        {selectedDate.toLocaleDateString('vi-VN')} <Calendar3 />
                    </div>
                </Container>
            </header>

            <div className="notice-bar text-center fw-bold">Lưu ý: Liên hệ quản lý nếu đặt lịch cố định.</div>

            <div className="legend-container-v3">
                <div className="legend-row-v3">
                    <div className="legend-item-v3"><span className="box-demo empty"></span> Trống</div>
                    <div className="legend-item-v3"><span className="box-demo held"></span> Đang giữ chỗ</div>
                    <div className="legend-item-v3"><span className="box-demo booked"></span> Đã đặt</div>
                    <div className="legend-item-v3"><span className="box-demo locked"></span> Khoá</div>
                    <div className="legend-item-v3"><span className="box-demo selecting"></span> Đang chọn</div>
                    <button type="button" className="pricing-link-v3" onClick={() => setShowPricingModal(true)}>Xem bảng giá</button>
                </div>
            </div>

            <div className="booking-note-panel">
                <Container>
                    <div className="booking-note-content">
                        <div><span className="note-label">Lưu ý:</span> Hỗ trợ khách hàng đặt lịch giờ</div>
                        {/* <div>17h-19h / 18h30-20h30 / 18h30-21h / 19h-21h / 19h30-22h / 20h30-22h30 / 19h-22h</div> */}
                        <div>Vui lòng liên hệ zalo/sđt: 0389603429</div>
                        <div>- Quý khách đặt lịch cố định / tháng vui lòng liên hệ: 0389603429 để được hỗ trợ tư vấn khuyến mại</div>
                        <div>- Quý khách vui lòng kiểm tra kỹ lịch đặt sân trước khi thanh toán</div>
                    </div>
                </Container>
            </div>

            <Container fluid className="px-4">
                <div className="matrix-wrapper">
                    <div className="grid-matrix-container" style={{ '--slot-count': bookableSlots.length }}>
                        <div className="grid-empty-header"></div>
                        {timeHeaders.map((time, index) => (
                            <div
                                key={time}
                                className={`grid-time-header ${index === timeHeaders.length - 1 ? 'last-time-header' : ''}`}
                                data-time={time}
                                data-end-time={index === timeHeaders.length - 1 ? scheduleRange.end : ''}
                            >
                                {index === timeHeaders.length - 1 && <span className="end-time-label">{scheduleRange.end}</span>}
                            </div>
                        ))}
                        <div className="grid-field-name-label">{fieldData.fieldName}</div>
                        {bookableSlots.map(time => {
                            const slotStatus = getSlotStatus(time);
                            const isSelected = slotStatus === 'available' && selectedSlots.map(normalizeTime).includes(normalizeTime(time));
                            return (
                                <div key={time} className={`grid-slot-box ${slotStatus} ${isSelected ? 'active' : ''}`} onClick={() => handleSlotClick(time)} />
                            );
                        })}
                    </div>
                </div>
            </Container>

            <PricingModal
                show={showPricingModal}
                onHide={() => setShowPricingModal(false)}
                fieldName={fieldData.fieldName}
                pricingRules={pricingRules}
            />

            <Modal show={showDatePicker} onHide={() => setShowDatePicker(false)} centered dialogClassName="calendar-modal-content">
                <Modal.Body className="p-0">
                    <div className="calendar-header">
                        <ChevronLeft onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} />
                        <span>Tháng {viewDate.getMonth() + 1} / {viewDate.getFullYear()}</span>
                        <ChevronRight onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} />
                    </div>
                    <div className="px-3 pb-3"><div key={viewDate.getMonth()} className="calendar-days-grid">{renderCalendarDays()}</div></div>
                </Modal.Body>
            </Modal>

            {selectedSlots.length > 0 && (
                <div className="payment-bar-v3">
                    <Container className="d-flex align-items-center justify-content-between">
                        <div>
                            {/* Đã cập nhật font-size và thêm letter-spacing cho tinh tế */}
                            <span className="d-block fw-bold" style={{ color: '#ffffff', fontSize: '1.2rem', letterSpacing: '0.5px' }}>
                                Tổng thời gian: {(selectedSlots.length * 0.5)} giờ
                            </span>
                            <h4 className="fw-bold mb-0" style={{ color: '#ffeb3b', fontSize: '1.6rem' }}>
                                Tổng tiền: {formatCurrency(calculateTotalAmount())} đ
                            </h4>
                        </div>
                        <Button className="btn-next-v3" onClick={() => handleProcessBooking()} disabled={isSubmitting}>
                            {isSubmitting ? 'ĐANG GIỮ CHỖ...' : 'TIẾP THEO'}
                        </Button>
                    </Container>
                </div>
            )}
        </div>
    );
};

export default BookingPage;
