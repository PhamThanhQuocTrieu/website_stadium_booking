// File: Frontend/src/pages/FieldDetailPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Container, Row, Col, Badge, Button, Spinner, ProgressBar } from 'react-bootstrap';
import { 
  StarFill, GeoAltFill, ArrowRight, HeartFill, CheckCircleFill, 
  ChatLeftDotsFill, Star, StarHalf
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2'; // 🌟 THÊM MỚI: Thư viện thông báo popup cao cấp
import { findPricingRule } from '../utils/pricing';
import '../styles/FieldDetailPage.css'; 

const FieldDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [field, setField] = useState(null);
  const [reviews, setReviews] = useState([]); // State lưu danh sách reviews thực tế từ CSDL Local
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [mainImage, setMainImage] = useState('');

  const fetchFieldDetail = async () => {
    try {
      // Gọi API Backend (API này trả về dạng: { field, reviews })
      const res = await axios.get(`http://localhost:5000/api/fields/${id}`);
      setField(res.data.field);
      setReviews(res.data.reviews || []);
      setMainImage(res.data.field?.image || '');
      setLoading(false);
    } catch (err) {
      console.error("Lỗi lấy chi tiết sân:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchFieldDetail();

    // Khởi tạo và ngắt socket an toàn trong vòng đời component
    const socket = io('http://localhost:5000');
    socket.on('field_updated', (data) => {
      if (data.id === id || data.data?._id === id) {
        fetchFieldDetail();
      }
    });

    return () => {
      socket.off('field_updated');
      socket.disconnect();
    };
  }, [id]);

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
      const rating = Number(r.rating || 0);
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
  }, [reviews]);

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
        
        {/* --- KHỐI 1: HÌNH ẢNH & THÔNG TIN TỔNG QUAN --- */}
        <div className="bg-white p-4 rounded-4 shadow-sm mb-4 border-0">
          <Row className="g-4">
            <Col lg={8}>
              <div className="main-image-container shadow-sm mb-3">
                <img src={mainImage || 'https://via.placeholder.com/800x600?text=ArenaHub'} alt="Main Arena" className="main-image" />
                <Badge bg="dark" className="image-label">PREMIUM ARENA • {summaryRating.overall} ★</Badge>
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
                <Badge bg="success" className="mb-2 bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill w-fit-content">
                  {field.status === 'Active' ? 'ĐANG HOẠT ĐỘNG' : 'BẢO TRÌ'}
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
                      {currentPricingRule?.price ? `${Number(currentPricingRule.price).toLocaleString('vi-VN')}đ` : 'Liên hệ'}
                    </h3>
                    <span className="text-muted fw-bold">/giờ</span>
                  </div>
                  <small className="text-muted fst-italic">
                    {currentPricingRule
                      ? `* ${currentPricingRule.ruleName || 'Khung giờ hiện tại'}: ${currentPricingRule.startTime} - ${currentPricingRule.endTime}`
                      : '* Giá biến động linh hoạt theo ngày thường, cuối tuần và ngày lễ.'}
                  </small>
                </div>

                <div className="mt-auto">
                  <Button 
                    variant="success" 
                    size="lg" 
                    className="w-100 py-3 rounded-pill fw-bold shadow-sm mb-3" 
                    onClick={() => navigate(`/booking/${field._id}`)}
                  >
                    ĐẶT SÂN NGAY <ArrowRight className="ms-2" />
                  </Button>
                  <Button variant="outline-danger" className="w-100 py-2 rounded-pill fw-bold" onClick={() => setIsFavorite(!isFavorite)}>
                    {isFavorite ? <><HeartFill className="me-2"/> ĐÃ LƯU</> : <><HeartFill className="me-2 text-muted"/> LƯU VÀO YÊU THÍCH</>}
                  </Button>
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* --- KHỐI 2: GIỚI THIỆU TÀI NGUYÊN --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> GIỚI THIỆU SÂN TẬP
          </h5>
          <div 
            className="rich-text-content"
            dangerouslySetInnerHTML={{ __html: field.description || '<p>Thông tin giới thiệu đang được cập nhật...</p>' }}
          />
        </div>

        {/* --- KHỐI 3: DỊCH VỤ TIỆN ÍCH --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> CÁC DỊCH VỤ & TIỆN ÍCH TRONG KHU VỰC
          </h5>
          <Row className="g-3">
            {field.services?.filter(s => s.isAvailable).map((s, i) => (
              <Col md={3} key={i}>
                <div className="service-item p-3 rounded-4 border d-flex align-items-center gap-3 bg-light bg-opacity-50">
                  <div className="icon-circle shadow-xs">
                     {s.name.toLowerCase().includes('xe') ? '🚗' : 
                      s.name.toLowerCase().includes('vợt') || s.name.toLowerCase().includes('bóng') ? '🎾' : 
                      s.name.toLowerCase().includes('nước') ? '🥤' : '🚿'}
                  </div>
                  <span className="fw-bold small text-secondary">{s.name}</span>
                  <CheckCircleFill className="ms-auto text-success" size={14} />
                </div>
              </Col>
            ))}
          </Row>
        </div>

        {/* --- KHỐI 4: BẢNG GIÁ CHI TIẾT THEO MÔ HÌNH BÓC TÁCH --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 d-flex align-items-center gap-2 text-dark">
            <div className="bg-success" style={{width:4, height:20, borderRadius:2}}></div> BẢNG GIÁ CHI TIẾT HỆ THỐNG
          </h5>
          <div className="table-responsive rounded-4 overflow-hidden border">
            <table className="table table-borderless mb-0 align-middle">
              <thead className="bg-dark text-white text-center">
                <tr>
                  <th className="py-3 fw-medium">LOẠI NGÀY ÁP DỤNG</th>
                  <th className="py-3 fw-medium">TÊN KHUNG GIỜ</th>
                  <th className="py-3 fw-medium">KHUNG GIỜ HOẠT ĐỘNG</th>
                  <th className="py-3 fw-medium">ĐƠN GIÁ NIÊM YẾT</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {field.pricingRules && field.pricingRules.length > 0 ? (
                  field.pricingRules.map((rule, idx) => (
                    <tr key={idx} className="border-bottom">
                      <td className="fw-bold py-3 text-secondary">
                        {rule.dayType === 'Weekday' ? 'Ngày thường (T2-T6)' : rule.dayType === 'Weekend' ? 'Cuối tuần (T7-CN)' : 'Ngày Lễ Tết'}
                      </td>
                      <td className="text-muted small fw-bold">{rule.ruleName}</td>
                      <td className="fw-bold text-primary">{rule.startTime} - {rule.endTime}</td>
                      <td className="fw-bold text-success">{rule.price?.toLocaleString()}đ/giờ</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="text-muted py-3 fst-italic">Chưa có cấu hình bảng giá cho sân này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- KHỐI 5: TỔNG QUAN ĐÁNH GIÁ & RENDER ĐÁNH GIÁ THỰC TẾ --- */}
        <div className="info-section-card bg-white p-4 rounded-4 shadow-sm mb-4">
          <h5 className="fw-bold mb-4 text-dark">PHÂN HỆ ĐÁNH GIÁ TỪ KHÁCH HÀNG</h5>
          <Row className="align-items-center mb-5">
            <Col md={3} className="text-center border-end py-3">
              <div className="display-3 fw-bold text-success">{summaryRating.overall}</div>
              <div className="text-warning mb-2 rating-stars">{renderStars(Number(summaryRating.overall), 18)}</div>
              <span className="text-muted small fw-bold">({summaryRating.count} đánh giá)</span>
            </Col>
            <Col md={9} className="ps-md-5">
              {summaryRating.distribution.map((item) => (
                <div key={item.star} className="mb-2">
                  <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span className="text-secondary">{item.star} sao</span>
                    <span className="text-success">{item.count}</span>
                  </div>
                  <ProgressBar now={item.percent} variant="success" style={{ height: '6px' }} />
                </div>
              ))}
            </Col>
          </Row>

          {/* RENDER DANH SÁCH CÁC BÀI BÌNH LUẬN LẤY TỪ MONGODB LOCAL */}
          <div className="reviews-list-container mb-5" style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '5px' }}>
            {reviews.length === 0 ? (
              <p className="text-muted text-center py-4 fst-italic">Sân bóng chưa có lượt đánh giá nào. Hãy để lại cảm nhận đầu tiên của bạn nhé!</p>
            ) : (
              reviews.map((r, idx) => (
                <div key={idx} className="p-4 rounded-4 bg-light d-flex gap-4 align-items-start mb-3 border-0 shadow-xs">
                  <div className="avatar-circle text-white fw-bold d-flex align-items-center justify-content-center rounded-circle" style={{ backgroundColor: '#198754', width: 45, height: 45, flexShrink: 0 }}>
                    {(r.user?.fullName || r.name || 'AH').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between mb-2">
                      <h6 className="fw-bold mb-0 text-dark">{r.user?.fullName || r.name || 'Người dùng ArenaHub'}</h6>
                      <div className="rating-stars text-warning">{renderStars(Number(r.rating || 0), 14)}</div>
                    </div>
                    <p className="text-muted small mb-2">{r.comment}</p>
                    <div className="text-muted fw-bold" style={{ fontSize: '10px' }}>
                      📅 Ngày gửi: {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* FORM TIẾP NHẬN PHẢN HỒI ĐÁNH GIÁ MỚI */}
          <div className="p-4 rounded-4 border bg-white shadow-sm mt-5">
             <h5 className="fw-bold mb-2 text-dark"><ChatLeftDotsFill className="me-2 text-success"/> Đánh giá sau khi đặt sân</h5>
             <p className="text-muted small mb-3">
               Để đảm bảo đánh giá thật, bạn chỉ có thể đánh giá từ lịch sử đặt sân khi booking đã hoàn thành.
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
