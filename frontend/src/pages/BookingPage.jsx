import React, { useState, useEffect, useCallback } from 'react';
import { Container, Button, Modal, Spinner } from 'react-bootstrap';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'react-bootstrap-icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import '../styles/BookingPage.css';
const socket = io('http://localhost:5000');
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
    // Tạo đúng 37 slots từ 6:00 đến 24:00
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
            setBookedSlots(res.data.bookedSlots || []);
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
                fetchBookingStatus();
                setSelectedSlots(prev => prev.filter(slot => !data.slots.includes(slot)));
            }
        });
        return () => socket.off('slot_booked_success');
    }, [id, selectedDate, fetchBookingStatus, formatDateStr]);
    const calculateTotalAmount = () => {
        return selectedSlots.reduce((total, slotTime) => {
            const hour = parseInt(slotTime.split(':')[0]);
            const dayOfWeek = selectedDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const rule = pricingRules.find(r => {
                const startH = parseInt(r.startTime.split(':')[0]);
                const endH = parseInt(r.endTime.split(':')[0]);
                const matchDay = isWeekend ? r.dayType === 'Weekend' : r.dayType === 'Weekday';
                return matchDay && hour >= startH && hour < endH;
            });
            const pricePerHour = rule ? rule.price : 100000;
            return total + (pricePerHour / 2);
        }, 0);
    };
    const triggerAlert = (msg) => {
        setAlertMessage(msg);
        setTimeout(() => setAlertMessage(''), 2000);
    };
    const getDayTypeLabel = (dayType) => {
        if (dayType === 'Weekend') return 'Cuoi tuan';
        if (dayType === 'Holiday') return 'Ngay le';
        return 'Ngay thuong';
    };
    const getSlotStatus = (time) => {
        const normalizeTime = (value) => {
            const [hour, minute] = value.split(':').map(Number);
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        };
        if (bookedSlots.map(normalizeTime).includes(normalizeTime(time))) return 'booked';
        const [hour, minute] = time.split(':').map(Number);
        const now = new Date();
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);
        if (slotTime <= now) return 'locked';
        return 'available';
    };
    const handleSlotClick = (time) => {
        const status = getSlotStatus(time);
        if (status === 'locked') { triggerAlert(`⚠️ Khung giờ ${time} đã qua!`); return; }
        if (status === 'booked') { triggerAlert(`🚫 Khung giờ ${time} đã có khách!`); return; }
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
                navigate('/payment', { state: { bookingId: res.data.bookingId, totalAmount: calculateTotalAmount() } });
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
                {alertMessage && <div className="custom-toast">{alertMessage}</div>}
            </AnimatePresence>
            <header className="booking-nav-premium">
                <Container className="d-flex align-items-center justify-content-between">
                    <Button variant="link" className="text-white p-0" onClick={() => navigate(-1)}><ArrowLeft size={24} /></Button>
                    <h5 className="fw-bold mb-0" style={{ color: '#ffffff' }}>Đặt lịch — {fieldData.fieldName}</h5>
                    <div className="date-pill-v3" onClick={() => setShowDatePicker(true)}>{selectedDate.toLocaleDateString('vi-VN')} 📅</div>
                </Container>
            </header>
            <div className="notice-bar text-center fw-bold">Lưu ý: Liên hệ quản lý nếu đặt lịch cố định.</div>
            <div className="legend-container-v3">
                <div className="legend-row-v3">
                    <div className="legend-item-v3"><span className="box-demo empty"></span> Trống</div>
                    <div className="legend-item-v3"><span className="box-demo booked"></span> Đã đặt</div>
                    <div className="legend-item-v3"><span className="box-demo locked"></span> Khoá</div>
                    <div className="legend-item-v3"><span className="box-demo selecting"></span> Đang chọn</div>
                    <button type="button" className="pricing-link-v3" onClick={() => setShowPricingModal(true)}>
                        Xem san & bang gia
                    </button>
                </div>
            </div>
            <div className="booking-note-panel">
                <Container>
                    <div className="booking-note-content">
                        <div><span className="note-label">Luu y:</span> Hỗ trợ khách hàng đặt lịch:</div>
                        <div>Vui long lien he so dien thoai: <strong>0389603429</strong></div>
                        <div>Quý khách đặt lịch cố định theo tháng  vui lòng liên hệ số trên để được hỗ trợ.</div>
                        <div>Quý khách vui lòng kiểm tra lịch đặt sân trước khi xác nhận thanh toán.</div>
                    </div>
                </Container>
            </div>
            <Container fluid className="px-4">
                <div className="matrix-wrapper">
                    <div className="grid-matrix-container">
                        {/* Div rỗng căn lề cho cột Tên sân */}
                        <div className="grid-empty-header"></div>
                        {/* Render các mốc giờ */}
                        {timeSlots.map(time => (
                            <div key={time} className="grid-time-header" data-time={time}></div>
                        ))}
                        {/* Tên sân nằm bên trái */}
                        <div className="grid-field-name-label">{fieldData.fieldName}</div>
                        {/* Các ô chọn giờ */}
                        {timeSlots.map(time => (
                            <div
                                key={time}
                                className={`grid-slot-box ${getSlotStatus(time)} ${selectedSlots.includes(time) ? 'active' : ''}`}
                                onClick={() => handleSlotClick(time)} />
                        ))}
                    </div>
                </div>
            </Container>
            <Modal show={showDatePicker} onHide={() => setShowDatePicker(false)} centered dialogClassName="calendar-modal-content">
                <Modal.Body className="p-0">
                    <div className="calendar-header">
                        <ChevronLeft className="cursor-pointer" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} />
                        <span>Tháng {viewDate.getMonth() + 1} / {viewDate.getFullYear()}</span>
                        <ChevronRight className="cursor-pointer" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} />
                    </div>
                    <div className="calendar-weekdays px-3">
                        <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span className="text-danger">CN</span>
                    </div>
                    <div className="px-3 pb-3">
                        <div key={viewDate.getMonth()} className="calendar-days-grid">
                            {renderCalendarDays()}
                        </div>
                    </div>
                    <div className="calendar-footer border-top">
                        <Button variant="link" className="text-dark text-decoration-none" onClick={() => setShowDatePicker(false)}>Hủy</Button>
                        <Button style={{ background: '#0a4d31', border: 'none' }} onClick={() => setShowDatePicker(false)}>Xác nhận</Button>
                    </div>
                </Modal.Body>
            </Modal>
            <Modal show={showPricingModal} onHide={() => setShowPricingModal(false)} centered size="lg" dialogClassName="pricing-modal-content">
                <Modal.Header closeButton>
                    <Modal.Title>Bang gia san - {fieldData.fieldName}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {pricingRules.length > 0 ? (
                        <div className="pricing-table-wrap">
                            <table className="pricing-table-v3">
                                <thead>
                                    <tr>
                                        <th>Ten bang gia</th>
                                        <th>Loai ngay</th>
                                        <th>Khung gio</th>
                                        <th>Gia / gio</th>
                                        <th>Ghi chu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pricingRules.map((rule, index) => (
                                        <tr key={rule._id || index}>
                                            <td>{rule.ruleName || `Bang gia ${index + 1}`}</td>
                                            <td>{getDayTypeLabel(rule.dayType)}</td>
                                            <td>{rule.startTime} - {rule.endTime}</td>
                                            <td>{Number(rule.price || 0).toLocaleString()} d</td>
                                            <td>{rule.isPeakHour ? 'Gio cao diem' : 'Gia thuong'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="pricing-empty-v3">San nay chua co bang gia trong co so du lieu.</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPricingModal(false)}>Dong</Button>
                </Modal.Footer>
            </Modal>
            {selectedSlots.length > 0 && (
                <div className="payment-bar-v3">
                    <Container className="d-flex align-items-center justify-content-between">
                        <div className="text-white">
                            <span className="d-block fw-bold">Tổng thời gian: {(selectedSlots.length * 0.5)} giờ</span>
                            <h4 className="fw-bold mb-0" style={{ color: '#ffeb3b' }}>Tổng tiền: {calculateTotalAmount().toLocaleString()} đ</h4>
                        </div>
                        <Button className="btn-next-v3" disabled={isSubmitting} onClick={handleProcessBooking}>TIẾP THEO</Button>
                    </Container>
                </div>
            )}
        </div>
    );
};
export default BookingPage;
