import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Container, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { CalendarDays, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import socket from '../socket';
import '../styles/NewsPage.css';

const fallbackImage = 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
};

const NewsPage = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadNews = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const { data } = await axiosClient.get('/news');
      setNews(Array.isArray(data) ? data : data.news || []);
    } catch {
      setNews([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews(true);
    if (!socket.connected) socket.connect();
    socket.on('news_updated', loadNews);
    return () => socket.off('news_updated', loadNews);
  }, [loadNews]);

  const filteredNews = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return news;
    return news.filter((item) => [item.title, item.summary, item.category]
      .some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [news, search]);

  return (
    <div className="news-page">
      <Container>
        <div className="news-page-heading">
          <div>
            <span>Tin tức ArenaHub</span>
            <h1>Cập nhật mới nhất</h1>
          </div>
          <InputGroup className="news-search">
            <InputGroup.Text><Search size={18} /></InputGroup.Text>
            <Form.Control
              placeholder="Tìm tin tức..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
        </div>

        {loading ? (
          <div className="news-loading">
            <Spinner animation="border" variant="success" />
            <span>Đang tải tin tức...</span>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="news-empty">
            <h5>Chưa có tin tức phù hợp</h5>
            <p>Vui lòng quay lại sau hoặc thử từ khóa khác.</p>
          </div>
        ) : (
          <Row className="g-4">
            {filteredNews.map((item) => (
              <Col md={6} xl={4} key={item._id}>
                <Card as={Link} to={`/news/${item.slug || item._id}`} className="news-card">
                  <div className="news-card-image">
                    <img src={item.thumbnail || fallbackImage} alt={item.title} />
                  </div>
                  <Card.Body>
                    <div className="news-card-meta">
                      <Badge bg="success">{item.category || 'Tin tức chung'}</Badge>
                      <span><CalendarDays size={15} /> {formatDate(item.publishedAt || item.createdAt)}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.summary || 'Xem chi tiết tin tức từ ArenaHub.'}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
};

export default NewsPage;
