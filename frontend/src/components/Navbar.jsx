import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Form, NavDropdown, Image } from 'react-bootstrap';
import { Search, BoxArrowRight, Person, ListCheck, Bell, ShieldLock } from 'react-bootstrap-icons';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode"; // Nhớ cài đặt: npm install jwt-decode
import myLogo from '../assets/logo.png';
import '../styles/navbar.css'; 

const Navigation = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const updateUserInfo = () => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) setUser(JSON.parse(userInfo));
    else setUser(null);
  };

  // Hàm kiểm tra token hết hạn
  const checkTokenValidity = () => {
    const token = localStorage.getItem('userToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          console.log("Token đã hết hạn, tự động đăng xuất...");
          handleLogout();
        }
      } catch (error) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    updateUserInfo();
    checkTokenValidity(); // Kiểm tra ngay khi load
    
    const interval = setInterval(checkTokenValidity, 300000); // Kiểm tra mỗi 5 phút
    window.addEventListener('storage', updateUserInfo);
    
    return () => {
      window.removeEventListener('storage', updateUserInfo);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    window.dispatchEvent(new Event('storage'));
    setShowDropdown(false);
    navigate('/login');
  };

  const handleToggleSearch = (e) => {
    e.preventDefault();
    navigate(searchTerm.trim() ? `/fields?search=${encodeURIComponent(searchTerm.trim())}` : '/fields');
  };

  const isAdmin = user?.role === 'admin';
  const profileLink = isAdmin ? '/admin/profile' : '/profile';

  return (
    <Navbar expand="lg" className="shadow-sm fixed-top py-2 custom-navbar">
      <Container fluid className="px-5">
        <Navbar.Brand as={Link} to="/" className="py-0">
          <img src={myLogo} alt="ArenaHub Logo" style={{ height: '55px', width: 'auto' }} />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          
          <Nav className="mx-auto gap-3">
            <NavLink to="/" end className="fw-bold text-decoration-none nav-link-custom">Trang chủ</NavLink>
            <NavLink to="/fields" className="fw-bold text-decoration-none nav-link-custom">Sân tập</NavLink>
            <NavLink to="/news" className="fw-bold text-decoration-none nav-link-custom">Tin tức</NavLink>
            <NavLink to="/support" className="fw-bold text-decoration-none nav-link-custom">Hỗ trợ</NavLink>
          </Nav>

          <div className="d-flex align-items-center gap-3">
            <Form onSubmit={handleToggleSearch} className="d-none d-xl-block">
              <div className="d-flex align-items-center bg-light px-3 rounded-pill search-input-wrapper" style={{ height: '42px', width: '260px' }}>
                <Form.Control placeholder="Tìm tên sân..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-0 bg-transparent shadow-none small p-0" />
                <Button type="submit" variant="link" className="p-0 text-muted"><Search size={15} /></Button>
              </div>
            </Form>
            
            {user ? (
              <div className="d-flex align-items-center gap-3">
                <Button variant="link" className="p-0 text-dark position-relative">
                  <Bell size={20} />
                  <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>
                </Button>

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