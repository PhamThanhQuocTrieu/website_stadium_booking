import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Badge, Card, Spinner, InputGroup, Pagination, Row, Col } from 'react-bootstrap';
import { Plus, Edit, Trash2, Lock, Unlock, Search } from 'lucide-react';
import axiosClient from '../../api/axiosClient'; // Import instance mới
import Swal from 'sweetalert2';
import { io } from "socket.io-client";
import '../../styles/admin/usermanager.css';

const socket = io("http://localhost:5000");

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const initialForm = { fullName: '', email: '', phone: '', role: 'user', isActive: true, lockReason: '' };
  const [formData, setFormData] = useState(initialForm);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      setFetching(true);
      // Sử dụng axiosClient (tự động kèm token)
      const res = await axiosClient.get(`/users?page=${page}&search=${search}&role=${filterRole}&status=${filterStatus}`);
      if (res.data?.users) {
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể tải danh sách!', 'error');
    } finally { setFetching(false); }
  };

  useEffect(() => {
    fetchUsers();
    socket.on('userUpdated', () => fetchUsers());
    return () => socket.off('userUpdated');
  }, [page, search, filterRole, filterStatus]);

  const openModal = (user = null) => {
    setFormData(user ? { ...user } : initialForm);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const passwordInput = e.target.elements['password']?.value;
    try {
      if (formData._id) {
        await axiosClient.put(`/users/${formData._id}`, formData);
        Swal.fire('Thành công', 'Đã cập nhật!', 'success');
      } else {
        const payload = { ...formData, password: passwordInput || 'Password@123' };
        await axiosClient.post('/users', payload);
        Swal.fire('Thành công', 'Đã thêm mới!', 'success');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) { 
      Swal.fire('Lỗi', err.response?.data?.message || 'Thao tác thất bại!', 'error'); 
    } finally { setLoading(false); }
  };

  const handleLock = async (user) => {
    const { value: reason } = await Swal.fire({
      title: 'Khóa tài khoản?',
      input: 'text',
      inputLabel: 'Nhập lý do khóa:',
      showCancelButton: true,
      inputValidator: (v) => !v && 'Bạn cần nhập lý do!'
    });
    if (reason) {
      try {
        await axiosClient.put(`/users/${user._id}`, { isActive: false, lockReason: reason });
        Swal.fire('Thành công', 'Đã khóa tài khoản!', 'success');
        fetchUsers();
      } catch (err) { Swal.fire('Lỗi', 'Không thể khóa!', 'error'); }
    }
  };

  const toggleStatus = async (user) => {
    try {
        await axiosClient.put(`/users/${user._id}`, { isActive: true, lockReason: "" });
        Swal.fire('Thành công', 'Tài khoản đã được mở khóa!', 'success');
        fetchUsers();
    } catch (err) { Swal.fire('Lỗi', 'Không thể mở khóa!', 'error'); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({ title: 'Xóa vĩnh viễn?', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) {
      try { 
        await axiosClient.delete(`/users/${id}`); 
        fetchUsers();
      } catch (err) { Swal.fire('Lỗi', 'Xóa thất bại!', 'error'); }
    }
  };

  // ... (Giữ nguyên phần return JSX của bạn)
  return (
    <div className="p-4 user-manager-container">
      <div className="d-flex justify-content-between mb-4">
        <h3 className="fw-bold">Quản lý khách hàng</h3>
        <Button variant="success" onClick={() => openModal()}><Plus size={18}/> Thêm mới</Button>
      </div>

      <Row className="mb-3 g-2">
        <Col md={4}>
          <InputGroup>
            <InputGroup.Text><Search size={18}/></InputGroup.Text>
            <Form.Control placeholder="Tìm tên hoặc email..." onChange={(e) => setSearch(e.target.value)} />
          </InputGroup>
        </Col>
        <Col md={4} className="d-flex gap-2">
          <Form.Select onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">Mọi vai trò</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Form.Select>
          <Form.Select onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Mọi trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Đã khóa</option>
          </Form.Select>
        </Col>
      </Row>

      {fetching ? <div className="text-center py-5"><Spinner animation="border" /></div> : (
        <Card className="border-0 shadow-sm rounded-4 p-3">
          <Table hover className="align-middle mb-0">
            <thead><tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td className="fw-semibold">{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td><Badge bg={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</Badge></td>
                  <td className="text-center">
                    <Button variant="light" size="sm" className="me-2" onClick={() => u.isActive ? handleLock(u) : toggleStatus(u)}>
                      {u.isActive ? <Lock size={16} className="text-danger"/> : <Unlock size={16} className="text-success"/>}
                    </Button>
                    <Button variant="light" size="sm" className="me-2" onClick={() => openModal(u)}><Edit size={16} className="text-primary"/></Button>
                    <Button variant="light" size="sm" onClick={() => handleDelete(u._id)}><Trash2 size={16} className="text-danger"/></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination className="justify-content-center mt-3">
            {[...Array(totalPages)].map((_, i) => <Pagination.Item key={i} active={i + 1 === page} onClick={() => setPage(i + 1)}>{i + 1}</Pagination.Item>)}
          </Pagination>
        </Card>
      )}
      
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>{formData._id ? 'Cập nhật tài khoản' : 'Thêm mới khách hàng'}</Modal.Title></Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label>Họ tên</Form.Label><Form.Control value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Số điện thoại</Form.Label><Form.Control value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></Form.Group>
            {!formData._id && (<Form.Group className="mb-3"><Form.Label>Mật khẩu</Form.Label><Form.Control name="password" type="password" /></Form.Group>)}
            <Form.Group className="mb-3"><Form.Label>Vai trò</Form.Label><Form.Select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="user">User</option><option value="admin">Admin</option></Form.Select></Form.Group>
          </Modal.Body>
          <Modal.Footer><Button variant="success" type="submit" disabled={loading}>{loading ? <Spinner size="sm"/> : 'Lưu dữ liệu'}</Button></Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};
export default UserManager;