// File: Frontend/src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Badge, Carousel, Card, Spinner } from 'react-bootstrap';
import { ArrowRight } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import {
  Clock,
  CreditCard,
  Quote,
  Search,
  Star
} from 'lucide-react';
import { getRulePrice } from '../utils/pricing';
import '../styles/HomePage.css';

import banner1 from '../assets/banner1.png';
import banner2 from '../assets/banner2.png';
import banner3 from '../assets/banner1.png';
import banner4 from '../assets/banner2.png';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } }
};

const staggerCards = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};

const fallbackNews = [
  {
    _id: 'fallback-news-1',
    title: '5 lưu ý khi đặt sân thể thao cuối tuần',
    summary: 'Chuẩn bị lịch chơi tốt hơn, tránh giờ cao điểm và chọn sân phù hợp với nhóm.',
    thumbnail: '/image/soccer/phui2.jpg',
    publishedAt: '2026-06-20'
  },
  {
    _id: 'fallback-news-2',
    title: 'Pickleball tiếp tục thu hút người chơi mới',
    summary: 'Môn thể thao linh hoạt, dễ bắt đầu và phù hợp cho các nhóm bạn trẻ.',
    thumbnail: '/image/pickleball/sanpick2.webp',
    publishedAt: '2026-06-18'
  },
  {
    _id: 'fallback-news-3',
    title: 'ArenaHub cập nhật thêm ưu đãi đặt sân buổi tối',
    summary: 'Các mã giảm giá mới giúp người chơi tiết kiệm hơn khi đặt sân ngoài giờ cao điểm.',
    thumbnail: '/image/tennis/tenis1.jpg',
    publishedAt: '2026-06-15'
  }
];

const getImageUrl = (src, fallback = '/image/soccer/sanbong1.jpg') => {
  if (!src) return fallback;
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return src.startsWith('/') ? src : `/${src.replace(/^public\//, '')}`;
};

const HomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [allFields, setAllFields] = useState([]);
  const [homeBanners, setHomeBanners] = useState([]);
  const [latestNews, setLatestNews] = useState(fallbackNews);
  const [topReviews, setTopReviews] = useState([]);

  const [searchParams, setSearchParams] = useState({
    location: '',
    type: 'Tất cả',
    dateTime: ''
  });

  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/fields');
      setAllFields(res.data);
      fetchTopFieldReviews(Array.isArray(res.data) ? res.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Lỗi lấy dữ liệu sân:', err);
      setLoading(false);
    }
  };

  const fetchHomeBanners = async (showLoading = true) => {
    try {
      if (showLoading) setBannerLoading(true);
      const res = await axios.get('http://localhost:5000/api/banners/home');
      setHomeBanners(Array.isArray(res.data) ? res.data : res.data.banners || []);
    } catch (err) {
      console.error('Lỗi lấy banner trang chủ:', err);
      setHomeBanners([]);
    } finally {
      setBannerLoading(false);
    }
  };

  const fetchLatestNews = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/news');
      const newsList = Array.isArray(res.data) ? res.data : res.data.news || res.data.data || [];
      if (newsList.length > 0) setLatestNews(newsList.slice(0, 3));
    } catch (err) {
      console.error('Lỗi lấy tin tức trang chủ:', err);
      setLatestNews(fallbackNews);
    }
  };

  const fetchTopFieldReviews = async (fields = []) => {
    const reviewFields = fields
      .filter((field) => field?._id)
      .sort((a, b) => Number(b.ratingCount || 0) - Number(a.ratingCount || 0))
      .slice(0, 12);

    if (reviewFields.length === 0) {
      setTopReviews([]);
      return;
    }

    try {
      const results = await Promise.allSettled(
        reviewFields.map((field) => axios.get(`http://localhost:5000/api/reviews/field/${field._id}`))
      );

      const reviews = results
        .flatMap((result) => (result.status === 'fulfilled' && Array.isArray(result.value.data) ? result.value.data : []))
        .filter((review) => Number(review.rating) === 5 && review.isHidden !== true)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 4);

      setTopReviews(reviews);
    } catch (err) {
      console.error('Lỗi lấy đánh giá 5 sao trang chủ:', err);
      setTopReviews([]);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHomeBanners();
    fetchLatestNews();
    AOS.init({ duration: 1000, once: true });

    const socket = io('http://localhost:5000');

    console.log('Đã kích hoạt lắng nghe biến động tài nguyên Real-time ArenaHub...');

    socket.on('field_updated', (data) => {
      console.log('[Socket.io] Phát hiện database có sự thay đổi từ Admin:', data?.message);
      fetchData();
    });

    socket.on('slot_booked_success', () => {
      fetchData();
    });

    socket.on('banner_updated', () => {
      fetchHomeBanners(false);
    });

    return () => {
      socket.off('field_updated');
      socket.off('slot_booked_success');
      socket.off('banner_updated');
      socket.disconnect();
    };
  }, []);

  const getCurrentPrice = (field) => {
    return getRulePrice(field.pricingRules || [], new Date());
  };

  const featuredFields = allFields.filter((f) => f.isFeatured === true);
  const footballFields = allFields.filter((f) => f.type === 'Bóng đá').slice(0, 4);
  const badmintonFields = allFields.filter((f) => f.type === 'Cầu lông').slice(0, 4);
  const pickleballFields = allFields.filter((f) => f.type === 'Pickleball').slice(0, 4);
  const tennisFields = allFields.filter((f) => f.type === 'Tennis').slice(0, 4);

  const fallbackHeroBanners = [banner1, banner2, banner3, banner4].map((image, index) => ({
    _id: `fallback-${index}`,
    image,
    title: '',
    subtitle: '',
    description: '',
    buttonText: '',
    buttonLink: '',
    voucherCode: ''
  }));
  const heroBanners = homeBanners.filter((banner) => banner.position === 'home_hero');
  const promoBanners = homeBanners.filter((banner) => banner.position === 'home_promo');
  const displayHeroBanners = heroBanners.length > 0 ? heroBanners : fallbackHeroBanners;

  const handleSearch = () => {
    const query = new URLSearchParams(searchParams).toString();
    navigate(`/fields?${query}`);
  };

  const handleBannerClick = (link) => {
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(link.startsWith('/') ? link : `/${link}`);
  };

  const handleNewsClick = (article) => {
    const target = article?.slug || article?._id;
    if (target && !String(target).startsWith('fallback-news')) {
      navigate(`/news/${target}`);
      return;
    }
    navigate('/news');
  };

  const FieldCard = ({ field }) => {
    const currentPrice = getCurrentPrice(field);
    return (
      <Col xs={12} sm={6} lg={3} className="mb-4" data-aos="zoom-in">
        <Card
          className="field-card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/field-detail/${field._id}`)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate(`/field-detail/${field._id}`);
            }
          }}
        >
          <div style={{ height: '180px', position: 'relative' }}>
            <Card.Img
              variant="top"
              src={field.image || 'https://via.placeholder.com/300x180?text=ArenaHub+Sport'}
              className="w-100 h-100"
              style={{ objectFit: 'cover' }}
              alt={field.fieldName}
            />
            {field.isFeatured && (
              <Badge bg="warning" className="position-absolute top-0 end-0 m-2 text-dark shadow-sm fw-bold">
                ★ Nổi bật
              </Badge>
            )}
          </div>
          <Card.Body className="p-3 d-flex flex-column">
            <h5 className="fw-bold mb-1 text-dark text-truncate" style={{ fontSize: '1.05rem' }}>
              {field.fieldName}
            </h5>
            <small className="text-muted mb-3 d-block text-truncate">📍 {field.address}</small>

            <div className="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
              <div>
                <small className="text-muted d-block" style={{ fontSize: '0.65rem', fontWeight: 700 }}>GIÁ TỪ</small>
                <span className="text-success fw-bold fs-5">
                  {currentPrice > 0 ? `${currentPrice.toLocaleString('vi-VN')}đ/h` : 'Liên hệ'}
                </span>
              </div>
              <Button
                variant="success"
                size="sm"
                className="fw-bold px-3 rounded-pill btn-details-premium"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/field-detail/${field._id}`);
                }}
              >
                CHI TIẾT
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  if (loading || bannerLoading) return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="text-center">
        <Spinner animation="border" variant="success" className="mb-2" />
        <h6 className="text-muted fw-bold">Đang đồng bộ phân hệ tài nguyên ArenaHub...</h6>
      </div>
    </div>
  );

  return (
    <div className="homepage-container">
      <section className="banner-top-section position-relative">
        <Carousel indicators={displayHeroBanners.length > 1} controls={displayHeroBanners.length > 1} interval={4500} fade pause={false}>
          {displayHeroBanners.map((banner, idx) => (
            <Carousel.Item key={banner._id || idx}>
              <div className="banner-container">
                <img src={banner.image} alt={banner.title || 'ArenaHub Promo Banner'} className="banner-img" />
              </div>
            </Carousel.Item>
          ))}
        </Carousel>

        <div className="search-overlay-container">
          <Container fluid className="homepage-container-fluid">
            <div className="search-bar-box shadow-lg bg-white p-4 rounded-4">
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Label className="fw-bold small text-secondary">Địa điểm khu vực</Form.Label>
                  <Form.Control
                    placeholder="Nhập quận Ninh Kiều, Cái Răng hoặc tên đường..."
                    value={searchParams.location}
                    onChange={(e) => setSearchParams({ ...searchParams, location: e.target.value })}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-bold small text-secondary">Loại hình thể thao</Form.Label>
                  <Form.Select
                    value={searchParams.type}
                    onChange={(e) => setSearchParams({ ...searchParams, type: e.target.value })}
                  >
                    <option value="Tất cả">Tất cả bộ môn</option>
                    <option value="Bóng đá">⚽ Bóng đá</option>
                    <option value="Cầu lông">🏸 Cầu lông</option>
                    <option value="Pickleball">🏓 Pickleball</option>
                    <option value="Tennis">🎾 Tennis</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-bold small text-secondary">Ngày & Giờ đặt sân</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={searchParams.dateTime}
                    onChange={(e) => setSearchParams({ ...searchParams, dateTime: e.target.value })}
                  />
                </Col>
                <Col md={2}>
                  <Button variant="success" className="w-100 py-2 fw-bold shadow-sm text-uppercase" onClick={handleSearch}>
                    Tìm sân ngay
                  </Button>
                </Col>
              </Row>
            </div>
          </Container>
        </div>
      </section>

      <Container fluid className="homepage-container-fluid homepage-main-content" style={{ marginTop: '90px', paddingBottom: '50px' }}>
        {promoBanners.length > 0 && (
          <div className="home-promo-section" data-aos="fade-up">
            <div className="section-heading-row d-flex justify-content-between align-items-center mb-4">
              <div>
                <span className="text-success fw-bold small text-uppercase" style={{ letterSpacing: '1px' }}>Ưu đãi ArenaHub</span>
                <h2 className="fw-bold text-dark mt-1">Khuyến mãi đang diễn ra</h2>
              </div>
            </div>
            <Row className="g-3">
              {promoBanners.map((banner) => (
                <Col md={6} xl={4} key={banner._id}>
                  <Card className="home-promo-card border-0 shadow-sm overflow-hidden h-100" onClick={() => handleBannerClick(banner.buttonLink)}>
                    <div className="home-promo-image">
                      <img src={banner.image} alt={banner.title} />
                    </div>
                    <Card.Body>
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <h5>{banner.title}</h5>
                        {banner.voucherCode && <Badge bg="warning" text="dark">{banner.voucherCode}</Badge>}
                      </div>
                      {banner.subtitle && <strong>{banner.subtitle}</strong>}
                      {banner.description && <p>{banner.description}</p>}
                      {banner.buttonText && <Button variant="link" className="p-0 text-success fw-bold">{banner.buttonText} <ArrowRight /></Button>}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        <section className="home-extra-section home-how-section">
          <div className="home-extra-heading">
            <span>Quy trình đặt sân</span>
            <h2>Đặt sân chỉ với 3 bước đơn giản</h2>
            <p>Chọn sân, chọn thời gian và thanh toán trong một luồng thao tác rõ ràng.</p>
          </div>

          <motion.div
            className="home-steps-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerCards}
          >
            {[
              {
                icon: Search,
                title: 'Chọn sân',
                description: 'Tìm kiếm và chọn sân phù hợp với nhu cầu của bạn.'
              },
              {
                icon: Clock,
                title: 'Chọn thời gian',
                description: 'Chọn ngày, khung giờ còn trống và dịch vụ đi kèm.'
              },
              {
                icon: CreditCard,
                title: 'Thanh toán',
                description: 'Thanh toán nhanh chóng và nhận xác nhận đặt sân.'
              }
            ].map((step, index) => (
              <motion.article className="home-step-card" key={step.title} variants={fadeUp}>
                <span className="home-step-number">{index + 1}</span>
                <div className="home-step-icon">
                  <step.icon size={30} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {index < 2 && <span className="home-step-arrow" aria-hidden="true">→</span>}
              </motion.article>
            ))}
          </motion.div>
        </section>

        {featuredFields.length > 0 && (
          <div className="my-5">
            <div className="section-heading-row d-flex justify-content-between align-items-center mb-4">
              <div>
                <span className="text-danger fw-bold small text-uppercase" style={{ letterSpacing: '1px' }}>— TOP CHOICE</span>
                <h2 className="fw-bold text-dark mt-1">Sân nổi bật hệ thống</h2>
              </div>
              <Button variant="link" className="text-success fw-bold text-decoration-none" onClick={() => navigate('/fields')}>
                XEM TẤT CẢ <ArrowRight />
              </Button>
            </div>
            <Row>
              {featuredFields.slice(0, 4).map((field) => <FieldCard key={field._id} field={field} />)}
            </Row>
          </div>
        )}

        {[
          { title: 'Sân bóng đá', data: footballFields },
          { title: 'Sân cầu lông', data: badmintonFields },
          { title: 'Sân Tennis đỉnh cao', data: tennisFields },
          { title: 'Sân Pickleball', data: pickleballFields }
        ].map((section, idx) => (
          section.data.length > 0 && (
            <div className="my-5" key={idx} data-aos="fade-up">
              <div className="section-heading-row d-flex justify-content-between align-items-center mb-4">
                <h3 className="fw-bold mb-0 border-start border-4 border-success ps-3 text-dark">{section.title}</h3>
                <Button
                  variant="link"
                  className="text-success fw-bold text-decoration-none small"
                  onClick={() => navigate(`/fields?type=${section.title.includes('Bóng') ? 'Bóng đá' : section.title.includes('Cầu') ? 'Cầu lông' : section.title.includes('Tennis') ? 'Tennis' : 'Pickleball'}`)}
                >
                  Xem thêm
                </Button>
              </div>
              <Row>
                {section.data.map((field) => <FieldCard key={field._id} field={field} />)}
              </Row>
            </div>
          )
        ))}
        <section className="home-extra-section">
          <div className="home-extra-heading">
            <span>Đánh giá</span>
            <h2>Khách hàng nói gì về ArenaHub</h2>
            <p>Những trải nghiệm thực tế từ người chơi đã đặt sân qua nền tảng.</p>
          </div>

          <motion.div
            className="home-testimonial-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerCards}
          >
            {topReviews.length > 0 ? topReviews.map((review, reviewIndex) => {
              const reviewerName = review.user?.fullName || review.user?.email || 'Khách hàng ArenaHub';
              const fieldName = review.field?.fieldName || 'Sân đã đặt';
              return (
                <motion.article className="home-testimonial-card" key={review._id || `${reviewerName}-${reviewIndex}`} variants={fadeUp}>
                  <Quote className="home-quote-icon" size={48} />
                  <div className="home-reviewer">
                    <img
                      src={review.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=198754&color=fff`}
                      alt={reviewerName}
                    />
                    <div>
                      <h3>{reviewerName}</h3>
                      <span>{fieldName}</span>
                    </div>
                  </div>
                  <div className="home-rating" aria-label={`${review.rating} sao`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={`${reviewIndex}-${starIndex}`}
                        size={16}
                        fill={starIndex < Number(review.rating || 0) ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                  <p>{review.comment}</p>
                </motion.article>
              );
            }) : (
              <div className="home-empty-reviews">
                Chưa có đánh giá 5 sao công khai để hiển thị.
              </div>
            )}
          </motion.div>
        </section>

        <section className="home-extra-section">
          <div className="home-extra-heading home-extra-heading-row">
            <div>
              <span>Tin tức</span>
              <h2>Tin tức mới nhất</h2>
              <p>Cập nhật ưu đãi, hướng dẫn đặt sân và xu hướng thể thao mới.</p>
            </div>
            <Button variant="link" className="text-success fw-bold text-decoration-none" onClick={() => navigate('/news')}>
              Xem tất cả <ArrowRight />
            </Button>
          </div>

          <motion.div
            className="home-news-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerCards}
          >
            {latestNews.slice(0, 3).map((article) => (
              <motion.article
                className="home-news-card"
                key={article._id || article.slug || article.title}
                variants={fadeUp}
                onClick={() => handleNewsClick(article)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleNewsClick(article);
                  }
                }}
              >
                <div className="home-news-thumb">
                  <img src={getImageUrl(article.thumbnail, '/image/tennis/tenis2.jpg')} alt={article.title || 'Tin tức ArenaHub'} />
                </div>
                <div className="home-news-body">
                  <time>
                    {article.publishedAt || article.createdAt
                      ? new Date(article.publishedAt || article.createdAt).toLocaleDateString('vi-VN')
                      : 'Mới cập nhật'}
                  </time>
                  <h3>{article.title || 'Tin tức ArenaHub'}</h3>
                  <p>{article.summary || article.description || 'Những thông tin mới nhất dành cho cộng đồng yêu thể thao.'}</p>
                  <button type="button" onClick={(event) => { event.stopPropagation(); handleNewsClick(article); }}>
                    Đọc thêm <ArrowRight />
                  </button>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>

      </Container>
    </div>
  );
};

export default HomePage;
