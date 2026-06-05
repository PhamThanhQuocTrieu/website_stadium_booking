import React, { useState, useEffect, useCallback } from 'react';
import { Container, Button, Modal, Spinner } from 'react-bootstrap';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar3, ChevronLeft, ChevronRight } from 'react-bootstrap-icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import '../styles/BookingPage.css';
import PricingModal from './PricingModal';

const socket = io('http://localhost:5000');

const timeToMinutes = (time) => {
    const [hour, minute = 0] = String(time).split(':').map(Number);
    return hour * 60 + minute;
};

const normalizeTime = (time) => {
    const [hour, minute = 0] = String(time).split(':').map(Number);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN');

const getRulePrice = (pricingRules, slotTime, selectedDate) => {
    const slotMinutes = timeToMinutes(slotTime);
    const dayOfWeek = selectedDate.getDay();
    const dayType = dayOfWeek === 0 || dayOfWeek === 6 ? 'Weekend' : 'Weekday';
    const sameDayRules = pricingRules.filter(rule => rule.dayType === dayType);
    const rulesForFallback = sameDayRules.length > 0 ? sameDayRules : pricingRules;

    const matchedRule = sameDayRules.find(rule => {
        const startMinutes = timeToMinutes(rule.startTime);
        const endMinutes = timeToMinutes(rule.endTime);
        return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });

    if (matchedRule) return Number(matchedRule.price || 0);

    const fallbackPrices = rulesForFallback
        .map(rule => Number(rule.price || 0))
        .filter(price => price > 0);

    return fallbackPrices.length > 0 ? Math.min(...fallbackPrices) : 100000;
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
    const [pricingRules, setPricingRules] = useState([]);

    const timeSlots = [];
    for (let hour = 6; hour <= 23; hour++) {
        timeSlots.push(`${hour}:00`, `${hour}:30`);
    }
    timeSlots.push("24:00");

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
            const res = await axios.get(`http://localhost:5000/api/bookings/fields/${id}/booking-status?date=${dateStr}`);
            setFieldData(res.data.field);
            setBookedSlots((res.data.bookedSlots || []).map(normalizeTime));
            setPricingRules(res.data.field?.pricingRules || []);
            setIsLoading(false);
        } catch (err) {
            console.error("Lỗi đồng bộ:", err);
            setIsLoading(false);
        }
    }, [id, selectedDate, formatDateStr]);

    useEffect(() => {
        fetchBookingStatus();
        socket.on('slot_booked_success', (data) => {
            if (data.fieldId === id && data.date === formatDateStr(selectedDate)) {
                setBookedSlots(prev => [...new Set([...prev, ...(data.slots || []).map(normalizeTime)])]);
                fetchBookingStatus();
                setSelectedSlots(prev => prev.filter(slot => !(data.slots || []).map(normalizeTime).includes(normalizeTime(slot))));
            }
        });
        return () => socket.off('slot_booked_success');
    }, [id, selectedDate, fetchBookingStatus, formatDateStr]);

    useEffect(() => {
        const refreshTimer = setInterval(() => {
            fetchBookingStatus();
        }, 15000);

        return () => clearInterval(refreshTimer);
    }, [fetchBookingStatus]);

    const calculateTotalAmount = () => {
        return selectedSlots.reduce((total, slotTime) => {
            return total + (getRulePrice(pricingRules, slotTime, selectedDate) / 2);
        }, 0);
    };

    const triggerAlert = (msg) => {
        setAlertMessage(msg);
        setTimeout(() => setAlertMessage(''), 2500);
    };

    const getSlotStatus = (time) => {
        if (bookedSlots.includes(normalizeTime(time))) return 'booked';
        const [hour, minute] = time.split(':').map(Number);
        const now = new Date();
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);
        if (slotTime <= now) return 'locked';
        return 'available';
    };

    const handleSlotClick = (time) => {
        const status = getSlotStatus(time);
        if (status === 'locked') { triggerAlert(`Khung giờ ${time} đã qua!`); return; }
        if (status === 'booked') { triggerAlert(`Khung giờ ${time} đã có khách!`); return; }
        setSelectedSlots(prev => prev.includes(time) ? prev.filter(s => s !== time) : [...prev, time]);
    };

    const handleProcessBooking = async () => {
        if (selectedSlots.length === 0 || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('userToken');
            const res = await axios.post('http://localhost:5000/api/bookings/reserve', {
                fieldId: id,
                date: formatDateStr(selectedDate),
                slots: selectedSlots,
                totalPrice: calculateTotalAmount()
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
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
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="custom-toast">
                        {alertMessage}
                    </motion.div>
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
                    <div className="legend-item-v3"><span className="box-demo booked"></span> Đã đặt</div>
                    <div className="legend-item-v3"><span className="box-demo locked"></span> Khoá</div>
                    <div className="legend-item-v3"><span className="box-demo selecting"></span> Đang chọn</div>
                    <button type="button" className="pricing-link-v3" onClick={() => setShowPricingModal(true)}>Xem bảng giá</button>
                </div>
            </div>

            <div className="booking-note-panel">
                <Container>
                    <div className="booking-note-content">
                        <div><span className="note-label">Lưu ý:</span> Hỗ trợ khách hàng đặt lịch giờ nhỏ:</div>
                        <div>17h-19h / 18h30-20h30 / 18h30-21h / 19h-21h / 19h30-22h / 20h30-22h30 / 19h-22h</div>
                        <div>Vui lòng liên hệ zalo/sđt: 0355867906</div>
                        <div>- Quý khách đặt lịch cố định / tháng vui lòng liên hệ: 0355867906 để được hỗ trợ tư vấn khuyến mại</div>
                        <div>- Quý khách vui lòng kiểm tra kỹ lịch đặt sân, Catchy chỉ hỗ trợ hoàn tiền/hủy trong vòng 1 tiếng từ khi lịch xác nhận và hoàn thành thanh toán</div>
                    </div>
                </Container>
            </div>

            <Container fluid className="px-4">
                <div className="matrix-wrapper">
                    <div className="grid-matrix-container">
                        <div className="grid-empty-header"></div>
                        {timeSlots.map(time => <div key={time} className="grid-time-header" data-time={time}></div>)}
                        <div className="grid-field-name-label">{fieldData.fieldName}</div>
                        {timeSlots.map(time => (
                            <div key={time} className={`grid-slot-box ${getSlotStatus(time)} ${selectedSlots.includes(time) ? 'active' : ''}`} onClick={() => handleSlotClick(time)} />
                        ))}
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
                        <div className="text-white">
                            <span className="d-block fw-bold">Tổng thời gian: {(selectedSlots.length * 0.5)} giờ</span>
                            <h4 className="fw-bold mb-0" style={{ color: '#ffeb3b' }}>Tổng tiền: {formatCurrency(calculateTotalAmount())} đ</h4>
                        </div>
                        <Button className="btn-next-v3" onClick={handleProcessBooking}>TIẾP THEO</Button>
                    </Container>
                </div>
            )}
        </div>
    );
};

export default BookingPage;
