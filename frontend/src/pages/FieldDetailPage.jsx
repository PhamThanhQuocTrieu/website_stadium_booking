// File: Frontend/src/pages/FieldDetailPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Container, Row, Col, Badge, Button, Spinner, Form, ProgressBar } from 'react-bootstrap';
import { 
  StarFill, GeoAltFill, ArrowRight, HeartFill, CheckCircleFill, 
  SendFill, ChatLeftDotsFill
} from 'react-bootstrap-icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2'; // 🌟 THÊM MỚI: Thư viện thông báo popup cao cấp
import '../styles/FieldDetailPage.css'; 

const FieldDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [field, setField] = useState(null);
  const [reviews, setReviews] = useState([]); // State lưu danh sách reviews thực tế từ CSDL Local
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [mainImage, setMainImage] = useState('');

  // State quản trị Form tiếp nhận phản hồi đánh giá mới
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    comment: ''
  });
  
  // State lưu trữ điểm số 4 tiêu chí của các thanh trượt range
  const [ratingsDetail, setRatingsDetail] = useState({
    sanBai: 5,
    trangThietBi: 5,
    dichVu: 5,
    viTriGia: 5
  });

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

  // 💡 HÀM XỬ LÝ GỬI ĐÁNH GIÁ LÊN CONTROLLER ĐÃ BÓC TÁCH (BẢN CAO CẤP)
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.comment) {
      Swal.fire({
        icon: 'warning',
        title: 'Thiếu thông tin',
        text: 'Vui lòng điền đầy đủ các trường thông tin bắt buộc (*)',
        confirmButtonColor: '#198754'
      });
      return;
    }

    try {
      const response = await axios.post(`http://localhost:5000/api/fields/${id}/reviews`, {
        ...formData,
        ratingsDetail
      });

      if (response.data.success) {
        // 🌟 HIỂN THỊ POPUP CHUYÊN NGHIỆP THAY CHO ALERT() CŨ
        Swal.fire({
          icon: 'success',
          title: 'Đăng đánh giá thành công!',
          text: 'Cảm ơn bạn đóng góp ý kiến xây dựng hệ thống ArenaHub.',
          confirmButtonColor: '#198754',
          timer: 2300, 
          timerProgressBar: true
        });

        // Reset Form nhập chữ, giữ nguyên điểm bản trượt mặc định là 5
        setFormData({ name: '', email: '', comment: '' });
        // Tải lại chi tiết để bài đánh giá mới xuất hiện tức thì trên giao diện
        fetchFieldDetail();
      }
    } catch (error) {
      console.error("Lỗi gửi đánh giá:", error);
      Swal.fire({
        icon: 'error',
        title: 'Gửi đánh giá thất bại',
        text: error.response?.data?.message || "Không thể gửi phản hồi lúc này, vui lòng thử lại sau.",
        confirmButtonColor: '#dc3545'
      });
    }
  };

  // Thuật toán useMemo tính điểm trung bình toán học hệ thống dựa trên mảng reviews thực tế
  const summaryRating = useMemo(() => {
    if (reviews.length === 0) {
      return { overall: "5.0", sanBai: 100, trangThietBi: 100, dichVu: 100, viTriGia: 100 };
    }
    
    let totalOverall = 0, totalSB = 0, totalTB = 0, totalDV = 0, totalVT = 0;
    reviews.forEach(r => {
      totalOverall += r.rating;
      totalSB += r.ratingsDetail?.sanBai || 5;
      totalTB += r.ratingsDetail?.trangThietBi || 5;
      totalDV += r.ratingsDetail?.dichVu || 5;
      totalVT += r.ratingsDetail?.viTriGia || 5;
    });

    const count = reviews.length;
    return {
      overall: (totalOverall / count).toFixed(1),
      sanBai: ((totalSB / count) / 5) * 100,
      trangThietBi: ((totalTB / count) / 5) * 100,
      dichVu: ((totalDV / count) / 5) * 100,
      viTriGia: ((totalVT / count) / 5) * 100
    };
  }, [reviews]);

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
                  <StarFill /><StarFill /><StarFill /><StarFill /><StarFill />
                  <span className="text-muted small fw-bold">({reviews.length} đánh giá thực tế)</span>
                </div>
                <p className="text-muted small mb-4"><GeoAltFill className="text-danger me-1"/> {field.address}</p>
                
                <div className="price-box p-3 rounded-4 border mb-4">
                  <div className="d-flex align-items-baseline gap-2">
                    <h3 className="fw-bold text-success mb-0">
                      {field.pricingRules?.[0]?.price ? `${field.pricingRules[0].price.toLocaleString()}đ` : '150.000đ'}
                    </h3>
                    <span className="text-muted fw-bold">/giờ</span>
                  </div>
                  <small className="text-muted fst-italic">* Giá biến động linh hoạt theo ngày thường, cuối tuần và ngày lễ.</small>
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
                      <td className="text-muted small fw-bold">{rule.slotName}</td>
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
              <div className="text-warning mb-2"><StarFill /><StarFill /><StarFill /><StarFill /><StarFill /></div>
              <span className="text-muted small fw-bold">({reviews.length} bình luận)</span>
            </Col>
            <Col md={9} className="ps-md-5">
              {[
                { label: 'Chất lượng sân bãi', value: summaryRating.sanBai },
                { label: 'Cơ sở vật chất & Ánh sáng', value: summaryRating.trangThietBi },
                { label: 'Dịch vụ đi kèm tại quầy', value: summaryRating.dichVu },
                { label: 'Vị trí địa lý và đơn giá', value: summaryRating.viTriGia }
              ].map((item, i) => (
                <div key={i} className="mb-2">
                  <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span className="text-secondary">{item.label}</span>
                    <span className="text-success">{((item.value / 100) * 5).toFixed(1)}</span>
                  </div>
                  <ProgressBar now={item.value} variant="success" style={{ height: '6px' }} />
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
                    {r.name ? r.name.substring(0, 2).toUpperCase() : 'QT'}
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between mb-2">
                      <h6 className="fw-bold mb-0 text-dark">{r.name}</h6>
                      <Badge bg="success" className="px-3 rounded-pill">{(r.rating || 5).toFixed(1)} ★</Badge>
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
             <h5 className="fw-bold mb-4 text-dark"><ChatLeftDotsFill className="me-2 text-success"/> GỬI PHẢN HỒI ĐÁNH GIÁ CỦA BẠN</h5>
             <Form onSubmit={handleSubmitReview}>
               <Row className="mb-4">
                 {[
                   { key: 'sanBai', label: 'Chất lượng sân bãi' },
                   { key: 'trangThietBi', label: 'Cơ sở vật chất & Ánh sáng' },
                   { key: 'dichVu', label: 'Dịch vụ đi kèm tại quầy' },
                   { key: 'viTriGia', label: 'Vị trí địa lý và đơn giá' }
                 ].map((item, i) => (
                   <Col md={12} key={i} className="mb-3">
                     <div className="d-flex align-items-center gap-3">
                       <span className="small fw-bold text-muted" style={{ width: 180 }}>{item.label}</span>
                       <input 
                         type="range" 
                         className="form-range flex-grow-1 custom-range" 
                         min="1" max="5" 
                         value={ratingsDetail[item.key]}
                         onChange={(e) => setRatingsDetail({ ...ratingsDetail, [item.key]: Number(e.target.value) })}
                       />
                       <Badge bg="success" className="px-2 rounded-pill">{ratingsDetail[item.key]}</Badge>
                     </div>
                   </Col>
                 ))}
               </Row>
               <Row className="g-3">
                 <Col md={6}>
                   <Form.Control 
                     placeholder="Họ và tên của bạn *" 
                     className="py-2 bg-light border-0 shadow-none small" 
                     value={formData.name}
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                   />
                 </Col>
                 <Col md={6}>
                   <Form.Control 
                     type="email"
                     placeholder="Địa chỉ thư điện tử (Email) *" 
                     className="py-2 bg-light border-0 shadow-none small" 
                     value={formData.email}
                     onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                   />
                 </Col>
                 <Col md={12}>
                   <Form.Control 
                     as="textarea" 
                     rows={4} 
                     placeholder="Nhập nội dung góp ý hoặc trải nghiệm thực tế tại đây..." 
                     className="bg-light border-0 shadow-none small" 
                     value={formData.comment}
                     onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                   />
                 </Col>
                 <Col md={12}>
                   <Button 
                     type="submit"
                     variant="success" 
                     className="px-5 py-3 fw-bold rounded-pill shadow-sm" 
                     style={{ backgroundColor: '#198754', border: 'none' }}
                   >
                     <SendFill className="me-2" /> HOÀN THÀNH BÌNH LUẬN
                   </Button>
                 </Col>
               </Row>
             </Form>
          </div>
        </div>

      </Container>
    </div>
  );
};

export default FieldDetailPage;