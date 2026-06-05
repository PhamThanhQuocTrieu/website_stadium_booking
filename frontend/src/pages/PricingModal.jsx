import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Calendar3, CashCoin, Clock, Clipboard2, CurrencyDollar, InfoCircle, Tag } from 'react-bootstrap-icons';
import '../styles/PricingModal.css';

const PricingModal = ({ show, onHide, fieldName, pricingRules }) => {
    const getDayTypeLabel = (dayType) => {
        if (dayType === 'Weekend') return 'Cuối tuần';
        if (dayType === 'Holiday') return 'Ngày lễ';
        return 'Ngày thường';
    };

    const getNoteLabel = (rule) => {
        if (rule.isPeakHour) return 'Giờ cao điểm';
        return 'Giá thường';
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            size="xl"
            dialogClassName="pricing-modal-modern"
        >
            <Modal.Header className="pricing-modal-header">
                <Modal.Title className="d-flex align-items-center gap-3">
                    <CashCoin className="price-icon" />
                    Bảng giá sân - <span className="field-name">{fieldName}</span>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-4">
                {pricingRules && pricingRules.length > 0 ? (
                    <div className="modern-pricing-table">
                        <table className="table table-hover">
                            <thead>
                                <tr>
                                    <th><Tag /> Tên bảng giá</th>
                                    <th><Calendar3 /> Loại ngày</th>
                                    <th><Clock /> Khung giờ</th>
                                    <th className="text-end"><CurrencyDollar /> Giá / giờ</th>
                                    <th><InfoCircle /> Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pricingRules.map((rule, index) => (
                                    <tr key={rule._id || index} className={rule.isPeakHour ? 'peak-row' : ''}>
                                        <td className="fw-semibold">
                                            {rule.ruleName || `Bảng giá ${index + 1}`}
                                        </td>
                                        <td>
                                            <span className={`day-badge ${rule.dayType?.toLowerCase()}`}>
                                                {getDayTypeLabel(rule.dayType)}
                                            </span>
                                        </td>
                                        <td className="fw-medium">
                                            {rule.startTime} - {rule.endTime}
                                        </td>
                                        <td className="text-end fw-bold price-cell">
                                            {Number(rule.price || 0).toLocaleString('vi-VN')} <span className="text-muted">đ</span>
                                        </td>
                                        <td>
                                            <span className={`note-badge ${rule.isPeakHour ? 'peak' : 'normal'}`}>
                                                {getNoteLabel(rule)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Clipboard2 className="empty-icon" />
                        <h5>Sân này chưa có bảng giá</h5>
                        <p className="text-muted">Vui lòng liên hệ quản lý sân để cập nhật bảng giá mới nhất.</p>
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer>
                <Button variant="success" onClick={onHide} className="px-5 py-2">
                    Đóng
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PricingModal;
