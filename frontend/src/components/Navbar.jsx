import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, Nav, Container, Button, Form, NavDropdown, Image } from 'react-bootstrap';
import { Search, BoxArrowRight, Person, ListCheck, ShieldLock, TicketPerforated } from 'react-bootstrap-icons';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode"; // Nhớ cài đặt: npm install jwt-decode
import myLogo from '../assets/logo.png';
import NotificationBell from './NotificationBell';
import '../styles/navbar.css'; 

const readUserInfo = () => {
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? JSON.parse(userInfo) : null;
};

const Navigation = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(() => readUserInfo());
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    window.dispatchEvent(new Event('authChanged'));
    setShowDropdown(false);
    navigate('/login');
  }, [navigate]);

  const updateUserInfo = useCallback(() => {
    setUser(readUserInfo());
  }, []);

  // Hàm kiểm tra token hết hạn
  const checkTokenValidity = useCallback(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          console.log("Token đã hết hạn, tự động đăng xuất...");
          handleLogout();
        }
      } catch {
        handleLogout();
      }
    }
  }, [handleLogout]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkTokenValidity(); // Kiểm tra ngay khi load
    
    const interval = setInterval(checkTokenValidity, 300000); // Kiểm tra định kỳ
    window.addEventListener('storage', updateUserInfo);
    window.addEventListener('authChanged', updateUserInfo);
    
    return () => {
      window.removeEventListener('storage', updateUserInfo);
      window.removeEventListener('authChanged', updateUserInfo);
      clearInterval(interval);
    };
  }, [checkTokenValidity, updateUserInfo]);

  const handleToggleSearch = (e) => {
    e.preventDefault();
    navigate(searchTerm.trim() ? `/fields?search=${encodeURIComponent(searchTerm.trim())}` : '/fields');
  };

  const role = String(user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super admin';
  const profileLink = isAdmin ? '/admin/profile' : '/profile';
  const isFieldsSection = location.pathname === '/fields' || location.pathname.startsWith('/field-detail/');

  return (
    <Navbar expand="lg" className="shadow-sm fixed-top py-2 custom-navbar">
      <Container fluid className="navbar-container">
        <Navbar.Brand as={Link} to="/" className="py-0 navbar-brand-custom">
          <img src={myLogo} alt="ArenaHub Logo" style={{ height: '55px', width: 'auto' }} />
        </Navbar.Brand>
        {user ? (
          <div className="mobile-header-actions d-lg-none">
            <NotificationBell user={user} />

            <NavDropdown
              show={showDropdown}
              onToggle={(nextShow) => setShowDropdown(nextShow)}
              title={
                <div className="d-inline-flex align-items-center cursor-pointer">
                  <Image src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'A')}&background=198754&color=fff`} roundedCircle style={{ width: '34px', height: '34px', border: '2px solid #198754', objectFit: 'cover' }} />
                </div>
              }
              id="mobile-user-dropdown"
              align="end"
              className="custom-dropdown mobile-user-dropdown"
            >
              <div className="px-3 py-2 border-bottom mb-1" onClick={() => setShowDropdown(false)}>
                  <p className="mb-0 fw-bold text-dark small">{user.fullName}</p>
                  <small className="text-muted">{user.email}</small>
              </div>

              {isAdmin && (
                <NavDropdown.Item as={Link} to="/admin/dashboard" onClick={() => setShowDropdown(false)}>
                  <ShieldLock className="me-2" size={16} /> Trang quản trị
                </NavDropdown.Item>
              )}

              <NavDropdown.Item as={Link} to={profileLink} onClick={() => setShowDropdown(false)}>
                  <Person className="me-2" size={16} /> Thông tin cá nhân
              </NavDropdown.Item>

              {!isAdmin && (
                <NavDropdown.Item as={Link} to="/my-vouchers" onClick={() => setShowDropdown(false)}>
                    <TicketPerforated className="me-2" size={16} /> Voucher của tôi
                </NavDropdown.Item>
              )}

              {!isAdmin && (
                <NavDropdown.Item as={Link} to="/my-bookings" onClick={() => setShowDropdown(false)}>
                    <ListCheck className="me-2" size={16} /> Lịch sử đặt sân
                </NavDropdown.Item>
              )}

              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout} className="text-danger">
                  <BoxArrowRight className="me-2" size={16} /> Đăng xuất
              </NavDropdown.Item>
            </NavDropdown>
          </div>
        ) : (
          <Button as={Link} to="/login" variant="success" className="mobile-login-btn d-lg-none rounded-pill fw-bold shadow-sm">Đăng nhập</Button>
        )}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          
          <Nav className="mx-auto gap-3 nav-links-wrap">
            <NavLink to="/" end className="fw-bold text-decoration-none nav-link-custom">Trang chủ</NavLink>
            <NavLink
              to="/fields"
              className={`fw-bold text-decoration-none nav-link-custom ${isFieldsSection ? 'active' : ''}`}
            >
              Sân tập
            </NavLink>
            <NavLink to="/news" className="fw-bold text-decoration-none nav-link-custom">Tin tức</NavLink>
            <NavLink to="/contact" className="fw-bold text-decoration-none nav-link-custom">Liên hệ</NavLink>
          </Nav>

          <div className="navbar-actions d-flex align-items-center gap-3">
            <Form onSubmit={handleToggleSearch} className="navbar-search-form">
              <div className="d-flex align-items-center bg-light px-3 rounded-pill search-input-wrapper">
                <Form.Control placeholder="Tìm tên sân..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none small p-0" />
                <Button type="submit" variant="link" className="p-0 text-muted"><Search size={15} /></Button>
              </div>
            </Form>
            
            {user ? (
              <div className="d-flex align-items-center gap-3">
                <NotificationBell user={user} />

                <NavDropdown 
                  show={showDropdown}
                  onMouseEnter={() => setShowDropdown(true)}
                  onMouseLeave={() => setTimeout(() => setShowDropdown(false), 200)}
                  title={
                    <div className="d-inline-flex align-items-center cursor-pointer">
                      <span className="me-2 fw-bold text-dark d-none d-md-inline" style={{ fontSize: '0.85rem' }}>Hi, {user.fullName?.split(' ').pop()}</span>
                      <Image src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'A')}&background=198754&color=fff`} roundedCircle style={{ width: '36px', height: '36px', border: '2px solid #198754', objectFit: 'cover' }} />
                    </div>
                  } 
                  id="user-dropdown" align="end" className="custom-dropdown"
                >
                  <div className="px-3 py-2 border-bottom mb-1" onClick={() => setShowDropdown(false)}>
                      <p className="mb-0 fw-bold text-dark small">{user.fullName}</p>
                      <small className="text-muted">{user.email}</small>
                  </div>
                  
                  {isAdmin && (
                    <NavDropdown.Item as={Link} to="/admin/dashboard" onClick={() => setShowDropdown(false)}>
                      <ShieldLock className="me-2" size={16} /> Trang quản trị
                    </NavDropdown.Item>
                  )}
                  
                  <NavDropdown.Item as={Link} to={profileLink} onClick={() => setShowDropdown(false)}>
                      <Person className="me-2" size={16} /> Thông tin cá nhân
                  </NavDropdown.Item>

                  {!isAdmin && (
                    <NavDropdown.Item as={Link} to="/my-vouchers" onClick={() => setShowDropdown(false)}>
                        <TicketPerforated className="me-2" size={16} /> Voucher của tôi
                    </NavDropdown.Item>
                  )}

                  {!isAdmin && (
                    <NavDropdown.Item as={Link} to="/my-bookings" onClick={() => setShowDropdown(false)}>
                        <ListCheck className="me-2" size={16} /> Lịch sử đặt sân
                    </NavDropdown.Item>
                  )}
                  
                  <NavDropdown.Divider />
                  <NavDropdown.Item onClick={handleLogout} className="text-danger">
                      <BoxArrowRight className="me-2" size={16} /> Đăng xuất
                  </NavDropdown.Item>
                </NavDropdown>
              </div>
            ) : (
              <Button as={Link} to="/login" variant="success" className="rounded-pill px-4 py-2 fw-bold shadow-sm btn-login-custom">Đăng nhập</Button>
            )}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};
export default Navigation;
