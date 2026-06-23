import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Card, Spinner, Form, Row, Col, Pagination, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Plus, MapPin, CheckCircle, AlertCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import '../../styles/admin/fieldmanager.css';

const FieldManager = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // States cho Lọc & Phân trang
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tất cả');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchFields = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/fields');
      setFields(Array.isArray(res.data) ? res.data : (res.data.fields || []));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchFields(); }, []);

  // Logic Lọc dữ liệu
  const filteredFields = useMemo(() => {
    return fields.filter(f => {
      const matchSearch = f.fieldName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'Tất cả' || f.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [fields, searchTerm, typeFilter]);

  // Logic Phân trang
  const paginatedFields = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFields.slice(start, start + itemsPerPage);
  }, [filteredFields, currentPage]);

  // Logic Xóa sân với thông báo thành công
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xóa sân này?',
      text: "Hành động này không thể hoàn tác!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xóa vĩnh viễn',
      cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`/admin/fields/${id}`);
        
        // Cập nhật UI ngay lập tức
        setFields(fields.filter(f => f._id !== id));
        
        // Thông báo thành công
        Swal.fire({
          icon: 'success',
          title: 'Đã xóa!',
          text: 'Tài nguyên sân đã được xóa khỏi hệ thống.',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (err) { 
        Swal.fire('Lỗi', 'Không thể xóa sân. Vui lòng thử lại!', 'error'); 
      }
    }
  };

  const handleToggleMaintenance = async (field) => {
    const maintenance = field.status !== 'Maintenance';
    try {
      const { data } = await axiosClient.patch(`/admin/fields/${field._id}/maintenance`, { maintenance });
      setFields(prev => prev.map(item => item._id === field._id ? data : item));
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: maintenance ? 'Đã bật bảo trì sân' : 'Đã mở sân hoạt động',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể cập nhật trạng thái sân.', 'error');
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Active') return <Badge bg="success"><CheckCircle size={12} /> Active</Badge>;
    if (status === 'Maintenance') return <Badge bg="warning"><AlertCircle size={12} /> Maintenance</Badge>;
    return <Badge bg="danger"><XCircle size={12} /> Full</Badge>;
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between mb-4">
        <h3>Quản lý Tài nguyên Sân</h3>
        <Button variant="success" onClick={() => navigate('/admin/addField')}><Plus size={20}/> Thêm sân mới</Button>
      </div>

      {/* Thanh bộ lọc */}
      <div className="filter-bar mb-3">
        <Row className="g-3">
          <Col md={8}>
            <Form.Control placeholder="Tìm tên sân hoặc địa chỉ..." onChange={e => setSearchTerm(e.target.value)} />
          </Col>
          <Col md={4}>
            <Form.Select onChange={e => setTypeFilter(e.target.value)}>
              <option value="Tất cả">Tất cả bộ môn</option>
              <option value="Bóng đá">Bóng đá</option>
              <option value="Pickleball">Pickleball</option>
              <option value="Cầu lông">Cầu lông</option>
              <option value="Tennis">Tennis</option>
            </Form.Select>
          </Col>
        </Row>
      </div>

      <Card className="admin-card border-0 shadow-sm">
        {loading ? <div className="text-center p-5"><Spinner animation="border" /></div> : (
          <Table hover responsive className="align-middle mb-0">
            <thead className="bg-light">
              <tr>
                <th>Hình ảnh</th>
                <th>Tên sân & Loại</th>
                <th>Địa chỉ</th>
                <th>Trạng thái</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFields.map(f => (
                <tr key={f._id}>
                  <td><img src={f.image || 'https://via.placeholder.com/60'} alt="field" className="field-img shadow-sm" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px'}} /></td>
                  <td><div className="fw-bold">{f.fieldName}</div><small className="text-muted">{f.type}</small></td>
                  <td><small><MapPin size={12} className="text-danger" /> {f.address}</small></td>
                  <td>{getStatusBadge(f.status)}</td>
                  <td className="text-center">
                    <Button
                      variant={f.status === 'Maintenance' ? 'outline-success' : 'outline-warning'}
                      size="sm"
                      className="me-2"
                      onClick={() => handleToggleMaintenance(f)}
                    >
                      {f.status === 'Maintenance' ? <ToggleLeft size={16} /> : <ToggleRight size={16} />} {f.status === 'Maintenance' ? 'Mở sân' : 'Bảo trì'}
                    </Button>
                    <Button variant="outline-primary" size="sm" className="me-2" onClick={() => navigate(`/admin/updateField/${f._id}`)}><Edit size={16} /></Button>
                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(f._id)}><Trash2 size={16} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Phân trang */}
      <Pagination className="pagination-custom mt-3 justify-content-center">
        {[...Array(Math.ceil(filteredFields.length / itemsPerPage)).keys()].map(p => (
            <Pagination.Item key={p+1} active={p+1 === currentPage} onClick={() => setCurrentPage(p+1)}>{p+1}</Pagination.Item>
        ))}
      </Pagination>
    </div>
  );
};

export default FieldManager;
