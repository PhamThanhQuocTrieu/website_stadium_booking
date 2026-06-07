import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Container, Spinner } from 'react-bootstrap';
import { CheckCircleFill, XCircleFill } from 'react-bootstrap-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/VnpayReturnPage.css';

const VnpayReturnPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const { data } = await axios.get(`http://localhost:5000/api/payments/vnpay/return${location.search}`);
        setResult(data);
      } catch (error) {
        setResult({
          success: false,
          message: error.response?.data?.message || 'Khong the xac minh giao dich.'
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [location.search]);

  const payment = result?.payment || result?.booking?.payment;
  const booking = result?.booking;
  const isSuccess = Boolean(result?.success);

  return (
    <div className="vnpay-return-page">
      <Container>
        <Card className="vnpay-result-card border-0 shadow-sm">
          <Card.Body>
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="success" className="mb-3" />
                <h5 className="fw-bold">Dang xac minh thanh toan...</h5>
              </div>
            ) : (
              <>
                <div className={`result-icon ${isSuccess ? 'success' : 'failed'}`}>
                  {isSuccess ? <CheckCircleFill size={44} /> : <XCircleFill size={44} />}
                </div>
                <h3 className="fw-bold mb-2">
                  {isSuccess ? 'Thanh toan thanh cong' : 'Thanh toan that bai'}
                </h3>
                <p className="text-muted mb-4">{result?.message}</p>

                <div className="result-info-grid">
                  <div>
                    <span>Ma don</span>
                    <strong>{booking?._id || payment?.bookingId || '-'}</strong>
                  </div>
                  <div>
                    <span>So tien</span>
                    <strong>{Number(payment?.amount || 0).toLocaleString('vi-VN')} d</strong>
                  </div>
                  <div>
                    <span>Trang thai</span>
                    <Badge bg={isSuccess ? 'success' : 'danger'}>{payment?.status || 'FAILED'}</Badge>
                  </div>
                  <div>
                    <span>TxnRef</span>
                    <strong>{payment?.txnRef || '-'}</strong>
                  </div>
                </div>

                <div className="result-actions">
                  <Button variant="success" onClick={() => navigate('/my-bookings')}>
                    Xem lich su dat san
                  </Button>
                  <Button variant="outline-secondary" onClick={() => navigate('/')}>
                    Quay ve trang chu
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default VnpayReturnPage;
