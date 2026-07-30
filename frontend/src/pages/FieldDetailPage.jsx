// File: Frontend/src/pages/FieldDetailPage.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Container, Row, Col, Badge, Button, Spinner, ProgressBar } from 'react-bootstrap';
import { 
  StarFill, GeoAltFill, ArrowRight, CheckCircleFill, 
  ChatLeftDotsFill, Star, StarHalf, Wifi, CarFrontFill, CupStraw,
  DropletFill, Tools, BagCheckFill, PatchCheckFill
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { findPricingRule } from '../utils/pricing';
import '../styles/FieldDetailPage.css'; 

const reviewCriteria = [
  { key: 'fieldQuality', label: 'Chất lượng sân' },
  { key: 'serviceQuality', label: 'Dịch vụ' },
  { key: 'cleanliness', label: 'Vệ sinh' },
  { key: 'priceReasonable', label: 'Giá cả' }
];

const FieldDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [field, setField] = useState(null);
  const [reviews, setReviews] = useState([]); // State lÆ°u danh sÃ¡ch reviews thá»±c táº¿ tá»« CSDL Local
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');

  const fetchFieldDetail = useCallback(async () => {
    try {
      const [fieldRes, reviewRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/fields/${id}`),
        axios.get(`http://localhost:5000/api/reviews/field/${id}`).catch(() => ({ data: null }))
      ]);
      const fieldData = fieldRes.data.field || fieldRes.data;
      const reviewData = Array.isArray(reviewRes.data) ? reviewRes.data : fieldRes.data.reviews || [];

      setField(fieldData);
      setReviews(reviewData);
      setMainImage(fieldData?.image || '');
      setLoading(false);
    } catch (err) {
      console.error("Loi lay chi tiet san:", err);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchTimer = setTimeout(fetchFieldDetail, 0);

    const socket = io('http://localhost:5000');
    socket.on('field_updated', (data) => {
      if (data.id === id || data.data?._id === id) {
        fetchFieldDetail();
      }
    });
    socket.on('review_updated', (data) => {
      if (String(data?.fieldId || '') === String(id)) {
        fetchFieldDetail();
      }
    });

    return () => {
      clearTimeout(fetchTimer);
      socket.off('field_updated');
      socket.off('review_updated');
      socket.disconnect();
    };
  }, [id, fetchFieldDetail]);

  const renderStars = (rating, size = 16, interactive = false, onSelect = null) => {
    const value = Number(rating || 0);
    return [1, 2, 3, 4, 5].map((starValue) => {
      const Icon = value >= starValue ? StarFill : value >= starValue - 0.5 ? StarHalf : Star;
      const stateClass = value >= starValue - 0.5 ? 'filled' : 'empty';
      return (
        <button
          key={starValue}
          type="button"
          className={`rating-star-button ${stateClass} ${interactive ? 'interactive' : ''}`}
          disabled={!interactive}
          onClick={() => onSelect?.(starValue)}
          aria-label={`${starValue} sao`}
        >
          <Icon size={size} />
        </button>
      );
    });
  };

  const getServiceIcon = (serviceName = '') => {
    const normalizedName = String(serviceName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalizedName.includes('wifi') || normalizedName.includes('wi-fi') || normalizedName.includes('internet')) return Wifi;
    if (normalizedName.includes('xe') || normalizedName.includes('bai dau') || normalizedName.includes('giu xe') || normalizedName.includes('parking')) return CarFrontFill;
    if (normalizedName.includes('nuoc') || normalizedName.includes('uống') || normalizedName.includes('uong') || normalizedName.includes('drink')) return CupStraw;
    if (normalizedName.includes('tam') || normalizedName.includes('voi sen') || normalizedName.includes('shower')) return DropletFill;
    if (normalizedName.includes('vot') || normalizedName.includes('bong') || normalizedName.includes('thue') || normalizedName.includes('dung cu')) return Tools;
    if (normalizedName.includes('tu do') || normalizedName.includes('locker') || normalizedName.includes('do dung')) return BagCheckFill;
    return PatchCheckFill;
  };

  const getReviewAverage = useCallback((review) => {
    const scores = reviewCriteria
      .map((item) => Number(review?.[item.key] || 0))
      .filter((value) => value >= 1 && value <= 5);
    if (scores.length === 0) return 0;
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }, []);

  // Tinh diem trung binh va phan bo sao theo cach cac he thong review nhu Google hien thi.
  const summaryRating = useMemo(() => {
    const distribution = [5, 4, 3, 2, 1].map((starValue) => ({
      star: starValue,
      count: 0,
      percent: 0
    }));

    if (reviews.length === 0) {
      return { overall: "0.0", count: 0, distribution };
    }
    
    let totalOverall = 0;
    reviews.forEach(r => {
      const rating = getReviewAverage(r);
      const bucketRating = Math.min(5, Math.max(1, Math.round(rating)));
      totalOverall += rating;

      const bucket = distribution.find(item => item.star === bucketRating);
      if (bucket) bucket.count += 1;
    });

    const count = reviews.length;
    distribution.forEach(item => {
      item.percent = count > 0 ? (item.count / count) * 100 : 0;
    });

    return {
      overall: (totalOverall / count).toFixed(1),
      count,
      distribution
    };
  }, [reviews, getReviewAverage]);

  const currentPricingRule = useMemo(() => {
    return findPricingRule(field?.pricingRules || [], new Date());
  }, [field]);

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <Spinner animation="border" variant="success" />
    </div>
  );

  if (!field) return <Container className="text-center py-5"><h3>Không tìm thấy dữ liệu sân tập.</h3></Container>;

  return (
    <div className="field-detail-scroll-page pb-5">
      <Container>
        
        {/* --- KHá»I 1: HÃŒNH áº¢NH & THÃ”NG TIN Tá»”NG QUAN --- */}
        <div className="bg-white p-4 rounded-4 shadow-sm mb-4 border-0">
          <Row className="g-4">
            <Col lg={8}>
              <div className="main-image-container shadow-sm mb-3">
                <img src={mainImage || 'https://via.placeholder.com/800x600?text=ArenaHub'} alt="Main Arena" className="main-image" />
                <Badge bg="dark" className="image-label">PREMIUM ARENA - {summaryRating.overall} sao</Badge>
              </div>
              <div className="thumbnail-list d-flex gap-3 overflow-auto pb-2 custom-scrollbar">
                <div className={`thumbnail ${mainImage === field.image ? 'active' : ''}`} onClick={() => setMainImage(field.image)}>
                  <img src={field.image} alt="Thumb" />
                </div>
                {field.gallery?.map((img, i) => (
                  <div key={i} className={`thumbnail ${mainImage === img ? 'active' : ''}`} onClick={() => setMainImage(img)}>
                    <img src={img} alt={`Gallery ${i}`} />
                  </div>
                ))}
              </div>
            </Col>

            <Col lg={4}>
              <div className="ps-lg-2 h-100 d-flex flex-column">
                <Badge bg={field.status === 'Active' ? 'success' : 'warning'} className="mb-2 bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill w-fit-content">
                  {field.status === 'Active' ? 'ĐANG HOẠT ĐỘNG' : 'ĐANG BẢO TRÌ'}
                </Badge>
                <h2 className="fw-bold text-dark mb-2">{field.fieldName}</h2>
                <div className="d-flex align-items-center gap-2 mb-3 text-warning">
                  <span className="rating-stars">{renderStars(Number(summaryRating.overall), 15)}</span>
                  <span className="text-muted small fw-bold">({reviews.length} đánh giá thực tế)</span>
                </div>
                <p className="text-muted small mb-4"><GeoAltFill className="text-danger me-1"/> {field.address}</p>
                
                <div className="price-box p-3 rounded-4 border mb-4">
                  <div className="d-flex align-items-baseline gap-2">
                    <h3 className="fw-bold text-success mb-0">
                      {currentPricingRule?.price ? `${Number(currentPricingRule.price).toLocaleString('vi-VN')}d` : 'Lien he'}
                    </h3>
                    <span className="text-muted fw-bold">/gio</span>
                  </div>
                  <small className="text-muted fst-italic">
                    {currentPricingRule
                      ? `* ${currentPricingRule.ruleName || 'Khung gio hien tai'}: ${currentPricingRule.startTime} - ${currentPricingRule.endTime}`
                      : '* Gia bien dong linh hoat theo ngay thuong, cuoi tuan va ngay le.'}
                  </small>
                </div>

                <div className="mt-auto">
                  <Button 
                    variant="success" 
                    size="lg" 
                    className="w-100 py-3 rounded-pill fw-bold shadow-sm mb-3" 
                    disabled={field.status !== 'Active'}
                    onClick={() => navigate(`/booking/${field._id}`)}
                  >
                    {field.status === 'Active' ? <>ĐẶT SÂN NGAY <ArrowRight className="ms-2" /></> : 'ĐANG BẢO TRÌ'}
                  </Button>
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* --- KHá»I 2: GIá»šI THIá»†U TÃ€I NGUYÃŠN --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> GIỚI THIỆU TÀI NGUYÊN SÂN TẬP
          </h5>
          <div 
            className="rich-text-content"
            dangerouslySetInnerHTML={{ __html: field.description || '<p>Thong tin gioi thieu dang duoc cap nhat...</p>' }}
          />
        </div>

        {/* --- KHá»I 3: Dá»ŠCH Vá»¤ TIá»†N ÃCH --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> CÁC DỊCH VỤ & TIỆN ÍCH TRONG KHU VỰC
          </h5>
          <Row className="g-3">
            {field.services?.filter(s => s.isAvailable).map((s, i) => (
              <Col md={3} key={i}>
                <div className="service-item p-3 rounded-4 border d-flex align-items-center gap-3 bg-light bg-opacity-50">
                  <div className="service-icon-circle shadow-xs">
                    {React.createElement(getServiceIcon(s.name), { size: 21 })}
                  </div>
                  <span className="fw-bold small text-secondary">{s.name}</span>
                  <CheckCircleFill className="ms-auto text-success" size={14} />
                </div>
              </Col>
            ))}
          </Row>
        </div>

        {/* --- KHá»I 4: Báº¢NG GIÃ CHI TIáº¾T THEO MÃ” HÃŒNH BÃ“C TÃCH --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> BẢNG GIÁ CHI TIẾT HỆ THỐNG
          </h5>
          <div className="field-pricing-table-wrap table-responsive rounded-4 border">
            <table className="table table-borderless mb-0 align-middle">
              <thead className="bg-dark text-white text-center">
                <tr>
                  <th className="py-3 fw-medium">LOẠI NGÀY ÁP DỤNG</th>
                  <th className="py-3 fw-medium">TÊN KHUNG GIỜ</th>
                  <th className="py-3 fw-medium">KHUNG GIỜ HOẠT ĐỘNG</th>
                  <th className="py-3 fw-medium">ĐƠN GIÁ NIỀM YẾT</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {field.pricingRules && field.pricingRules.length > 0 ? (
                  field.pricingRules.map((rule, idx) => (
                    <tr key={idx} className="border-bottom">
                      <td className="fw-bold py-3 text-secondary">
                        {rule.dayType === 'Weekday' ? 'Ngay thuong (T2-T6)' : rule.dayType === 'Weekend' ? 'Cuoi tuan (T7-CN)' : 'Ngay Le Tet'}
                      </td>
                      <td className="text-muted small fw-bold">{rule.ruleName}</td>
                      <td className="fw-bold text-primary">{rule.startTime} - {rule.endTime}</td>
                      <td className="fw-bold text-success">{rule.price?.toLocaleString()}d/gio</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="text-muted py-3 fst-italic">Chưa có cấu hình bảng giá cho sân này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- KHá»I 5: Tá»”NG QUAN ÄÃNH GIÃ & RENDER ÄÃNH GIÃ THá»°C Táº¾ --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 text-dark">Đánh giá từ khách hàng</h5>
          <div className="review-distribution mb-4">
            {summaryRating.distribution.map((item) => (
              <div key={item.star} className="review-distribution-row">
                <span className="review-distribution-label">{item.star} sao</span>
                <ProgressBar now={item.percent} className="review-distribution-bar" />
                <span className="review-distribution-count">{item.count}</span>
              </div>
            ))}
          </div>

          {/* RENDER DANH SÃCH CÃC BÃ€I BÃŒNH LUáº¬N Láº¤Y Tá»ª MONGODB LOCAL */}
          <div className="reviews-list-container mb-5">
            {reviews.length === 0 ? (
              <p className="text-muted text-center py-4 fst-italic">Sân bóng chưa có lượt đánh giá nào. Hãy để lại cảm nhận đầu tiên của bạn nhe!</p>
            ) : (
              reviews.map((r, idx) => {
                const average = getReviewAverage(r);
                const reviewerName = r.user?.fullName || r.name || 'Người dùng ArenaHub';
                const reviewerInitials = reviewerName.substring(0, 2).toUpperCase();

                return (
                  <div key={r._id || idx} className="review-detail-card">
                    <div className="review-detail-header">
                      <div className="d-flex align-items-start gap-3">
                        <div className="review-avatar">
                          {r.user?.avatar ? <img src={r.user.avatar} alt={reviewerName} /> : reviewerInitials}
                        </div>
                        <div>
                          <h6 className="reviewer-name">{reviewerName}</h6>
                          <div className="review-date">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                      <div className="rating-stars review-card-stars">{renderStars(average, 20)}</div>
                    </div>

                    <div className="review-criteria-list">
                      {reviewCriteria.map((item) => {
                        const value = Number(r[item.key] || 0);
                        if (!value) return null;
                        return <span key={item.key} className="review-criteria-chip">{item.label}: {value}/5</span>;
                      })}
                    </div>

                    <p className="review-comment">{r.comment}</p>

                    {Array.isArray(r.images) && r.images.length > 0 && (
                      <div className="review-images">
                        {r.images.map((image, imageIndex) => (
                          <img key={`${image}-${imageIndex}`} src={image} alt={`Ảnh đánh giá ${imageIndex + 1}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* FORM TIáº¾P NHáº¬N PHáº¢N Há»’I ÄÃNH GIÃ Má»šI */}
          <div className="p-4 rounded-4 border bg-white shadow-sm mt-5">
             <h5 className="fw-bold mb-2 text-dark"><ChatLeftDotsFill className="me-2 text-success"/> Đánh giá sau khi đặt sân</h5>
             <p className="text-muted small mb-3">
               Để đảm bảo đánh giá thực, bạn chỉ có thể đánh giá từ lịch sử đặt sân khi booking đã hoàn thành.
             </p>
             <Button
               variant="success"
               className="px-4 py-2 fw-bold rounded-pill shadow-sm"
               onClick={() => {
                 if (!localStorage.getItem('userToken')) {
                   Swal.fire('Cần đăng nhập', 'Vui lòng đăng nhập để xem lịch sử đặt sân và đánh giá.', 'info');
                   navigate('/login');
                   return;
                 }
                 navigate('/my-bookings');
               }}
             >
               Xem lịch sử đặt sân
             </Button>
          </div>
        </div>

      </Container>
    </div>
  );
};

export default FieldDetailPage;
