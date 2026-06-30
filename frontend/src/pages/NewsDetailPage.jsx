import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Container, Spinner } from 'react-bootstrap';
import { ArrowLeft, CalendarDays, ChevronRight, ExternalLink, Eye, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import '../styles/NewsPage.css';

const fallbackImage = 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80';

const categories = [
  'Khuyến mãi',
  'Hướng dẫn đặt sân',
  'Sự kiện thể thao',
  'Thông báo hệ thống',
  'Tin tức chung'
];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
};

const NewsDetailPage = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        setLoading(true);
        const [detailResponse, listResponse] = await Promise.all([
          axiosClient.get(`/news/${slug}`),
          axiosClient.get('/news')
        ]);
        setArticle(detailResponse.data.article || detailResponse.data);
        setRelatedNews(Array.isArray(listResponse.data) ? listResponse.data : listResponse.data.news || []);
      } catch {
        setArticle(null);
        setRelatedNews([]);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [slug]);

  const relatedItems = useMemo(() => {
    if (!article) return [];
    return relatedNews
      .filter((item) => item._id !== article._id)
      .sort((first, second) => {
        const firstScore = first.category === article.category ? 1 : 0;
        const secondScore = second.category === article.category ? 1 : 0;
        return secondScore - firstScore;
      })
      .slice(0, 4);
  }, [article, relatedNews]);

  if (loading) {
    return (
      <div className="news-detail-state">
        <Spinner animation="border" variant="success" />
        <span>Đang tải bài viết...</span>
      </div>
    );
  }

  if (!article) {
    return (
      <Container className="news-detail-state">
        <h4>Không tìm thấy tin tức</h4>
        <Link to="/news">Quay lại danh sách tin tức</Link>
      </Container>
    );
  }

  const isExternal = article.newsType === 'external';

  return (
    <article className="news-detail-page">
      <Container className="news-detail-container">
        <nav className="news-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <ChevronRight size={15} />
          <Link to="/news">Tin tức</Link>
          <ChevronRight size={15} />
          <span>Chi tiết tin</span>
        </nav>

        <div className="news-detail-layout">
          <main className="news-detail-main">
            <header className="news-detail-header">
              <div className="news-detail-kicker">
                <Badge bg="success">{article.category || 'Tin tức chung'}</Badge>
                {isExternal && <Badge className="news-external-badge">Nguồn ngoài</Badge>}
              </div>
              <h1>{article.title}</h1>
              {article.summary && <p>{article.summary}</p>}
              <div className="news-detail-meta">
                <span><CalendarDays size={16} /> {formatDate(article.publishedAt || article.createdAt)}</span>
                <span><Eye size={16} /> {Number(article.views || 0)} lượt xem</span>
                {(article.author?.fullName || article.author?.name) && (
                  <span><UserRound size={16} /> {article.author.fullName || article.author.name}</span>
                )}
              </div>
              <Link to="/news" className="news-back-link">
                <ArrowLeft size={18} />
                Quay lại tin tức
              </Link>
            </header>

            <img className="news-detail-image" src={article.thumbnail || fallbackImage} alt={article.title} />

            <div
              className="news-detail-content"
              dangerouslySetInnerHTML={{ __html: article.content || '' }}
            />

            {isExternal && (
              <section className="news-source-box" aria-label="Nguồn tham khảo">
                <h2>Nguồn tham khảo</h2>
                <dl>
                  <div>
                    <dt>Tên nguồn</dt>
                    <dd>{article.sourceName}</dd>
                  </div>
                  <div>
                    <dt>Link bài viết gốc</dt>
                    <dd>
                      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {article.sourceUrl}
                        <ExternalLink size={16} />
                      </a>
                    </dd>
                  </div>
                  {article.originalAuthor && (
                    <div>
                      <dt>Tác giả gốc</dt>
                      <dd>{article.originalAuthor}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </main>

          <aside className="news-detail-sidebar">
            <section className="news-sidebar-card">
              <h2>Tin liên quan</h2>
              {relatedItems.length > 0 ? (
                <div className="news-related-list">
                  {relatedItems.map((item) => (
                    <Link className="news-related-item" to={`/news/${item.slug || item._id}`} key={item._id}>
                      <img src={item.thumbnail || fallbackImage} alt={item.title} />
                      <span>
                        <strong>{item.title}</strong>
                        <small><CalendarDays size={14} /> {formatDate(item.publishedAt || item.createdAt)}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="news-sidebar-empty">Chưa có tin liên quan.</p>
              )}
            </section>

            <section className="news-sidebar-card">
              <h2>Danh mục tin tức</h2>
              <div className="news-category-list">
                {categories.map((category) => (
                  <Link to="/news" key={category}>
                    {category}
                    <ChevronRight size={15} />
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </Container>
    </article>
  );
};

export default NewsDetailPage;
