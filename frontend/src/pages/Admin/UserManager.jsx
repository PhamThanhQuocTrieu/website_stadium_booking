import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal, OverlayTrigger, Pagination, Spinner, Tooltip } from 'react-bootstrap';
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Download,
  Edit,
  Eye,
  Lock,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  UserX,
  Wallet,
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import '../../styles/admin/usermanager.css';

const socket = io('http://localhost:5000');

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'user',
  isActive: true,
  lockReason: '',
};

const roleLabels = {
  admin: 'Quản trị viên',
  user: 'Khách hàng',
  owner: 'Chủ sân',
  fieldOwner: 'Chủ sân',
  stadiumOwner: 'Chủ sân',
};

const formatDate = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return date.toLocaleDateString('vi-VN');
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

const getRoleLabel = (role) => roleLabels[role] || role || 'Khách hàng';

const getRoleClass = (role) => {
  if (role === 'admin') return 'admin-users-role-admin';
  if (['owner', 'fieldOwner', 'stadiumOwner'].includes(role)) return 'admin-users-role-owner';
  return 'admin-users-role-user';
};

const isProtectedAdmin = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return ['admin', 'super admin'].includes(String(role || '').toLowerCase());
};

const UserAvatar = ({ user, large = false }) => {
  const avatar = user?.avatar || user?.avatarUrl || user?.image;
  const label = getInitials(user?.fullName || user?.email);

  if (avatar) {
    return <img className={`admin-users-avatar ${large ? 'is-large' : ''}`} src={avatar} alt={user?.fullName || 'User'} />;
  }

  return <span className={`admin-users-avatar admin-users-avatar-fallback ${large ? 'is-large' : ''}`}>{label}</span>;
};

const ActionButton = ({ label, className = '', children, ...props }) => (
  <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
    <Button type="button" variant="light" className={`admin-users-icon-btn ${className}`} aria-label={label} {...props}>
      {children}
    </Button>
  </OverlayTrigger>
);

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [formData, setFormData] = useState(initialForm);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const visibleUsers = useMemo(() => {
    if (!filterDate) return users;
    return users.filter((user) => {
      if (!user.createdAt) return false;
      return new Date(user.createdAt).toISOString().slice(0, 10) === filterDate;
    });
  }, [users, filterDate]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      locked: users.filter((user) => !user.isActive).length,
      admins: users.filter((user) => isProtectedAdmin(user)).length,
      newThisMonth: users.filter((user) => {
        if (!user.createdAt) return false;
        const createdAt = new Date(user.createdAt);
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [users]);

  const selectableUsers = useMemo(() => visibleUsers.filter((user) => !isProtectedAdmin(user)), [visibleUsers]);
  const allVisibleSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedUsers.includes(user._id));
  const selectedActionIds = useMemo(() => {
    const protectedIds = new Set(users.filter((user) => isProtectedAdmin(user)).map((user) => user._id));
    return selectedUsers.filter((id) => !protectedIds.has(id));
  }, [selectedUsers, users]);
  const selectedCount = selectedActionIds.length;

  const fetchUsers = async () => {
    try {
      setFetching(true);
      setError('');
      const res = await axiosClient.get(`/users?page=${page}&search=${search}&role=${filterRole}&status=${filterStatus}`);
      if (res.data?.users) {
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages || 1);
        setSelectedUsers([]);
      }
    } catch (err) {
      console.error(err);
      setError('Không thể tải danh sách người dùng. Vui lòng thử lại sau.');
      Swal.fire('Lỗi', 'Không thể tải danh sách!', 'error');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    socket.on('userUpdated', () => fetchUsers());
    return () => socket.off('userUpdated');
  }, [page, search, filterRole, filterStatus]);

  const openModal = (user = null) => {
    if (isProtectedAdmin(user)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong duoc CRUD tai trang quan ly nguoi dung.', 'info');
      return;
    }

    setFormData(user ? { ...initialForm, ...user } : initialForm);
    setShowModal(true);
  };

  const openDetailModal = (user) => {
    if (isProtectedAdmin(user)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong duoc CRUD tai trang quan ly nguoi dung.', 'info');
      return;
    }

    setDetailUser(user);
    setShowDetailModal(true);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterRole('all');
    setFilterStatus('all');
    setFilterDate('');
    setPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isProtectedAdmin(formData)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong duoc CRUD tai trang quan ly nguoi dung.', 'info');
      return;
    }

    setLoading(true);
    const passwordInput = e.target.elements.password?.value;
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
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async (user) => {
    if (isProtectedAdmin(user)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong the bi khoa tai trang nay.', 'info');
      return;
    }

    const { value: reason } = await Swal.fire({
      title: 'Khóa tài khoản?',
      input: 'text',
      inputLabel: 'Nhập lý do khóa:',
      showCancelButton: true,
      confirmButtonText: 'Khóa',
      cancelButtonText: 'Hủy',
      inputValidator: (value) => !value && 'Bạn cần nhập lý do!',
    });
    if (!reason) return;

    try {
      await axiosClient.put(`/users/${user._id}`, { isActive: false, lockReason: reason });
      Swal.fire('Thành công', 'Đã khóa tài khoản!', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Không thể khóa!', 'error');
    }
  };

  const toggleStatus = async (user) => {
    if (isProtectedAdmin(user)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong the bi mo/khoa tai trang nay.', 'info');
      return;
    }

    try {
      await axiosClient.put(`/users/${user._id}`, { isActive: true, lockReason: '' });
      Swal.fire('Thành công', 'Tài khoản đã được mở khóa!', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Không thể mở khóa!', 'error');
    }
  };

  const handleDelete = async (user) => {
    if (isProtectedAdmin(user)) {
      Swal.fire('Khong the thao tac', 'Tai khoan admin khong the bi xoa tai trang nay.', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Xóa vĩnh viễn?',
      text: 'Người dùng này sẽ bị xóa khỏi hệ thống.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete(`/users/${user._id}`);
      Swal.fire('Đã xóa', 'Người dùng đã được xóa.', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Xóa thất bại!', 'error');
    }
  };

  const toggleSelectedUser = (user) => {
    if (isProtectedAdmin(user)) return;
    setSelectedUsers((current) => (current.includes(user._id) ? current.filter((userId) => userId !== user._id) : [...current, user._id]));
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedUsers((current) => current.filter((id) => !selectableUsers.some((user) => user._id === id)));
      return;
    }

    setSelectedUsers((current) => [...new Set([...current, ...selectableUsers.map((user) => user._id)])]);
  };

  const handleBulkLock = async () => {
    const { value: reason } = await Swal.fire({
      title: `Khóa ${selectedCount} người dùng?`,
      input: 'text',
      inputLabel: 'Nhập lý do khóa:',
      showCancelButton: true,
      confirmButtonText: 'Khóa hàng loạt',
      cancelButtonText: 'Hủy',
      inputValidator: (value) => !value && 'Bạn cần nhập lý do!',
    });
    if (!reason) return;

    try {
      await Promise.all(selectedActionIds.map((id) => axiosClient.put(`/users/${id}`, { isActive: false, lockReason: reason })));
      Swal.fire('Thành công', 'Đã khóa các tài khoản đã chọn!', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Không thể khóa hàng loạt!', 'error');
    }
  };

  const handleBulkUnlock = async () => {
    const result = await Swal.fire({
      title: `Mở khóa ${selectedCount} người dùng?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Mở khóa',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    try {
      await Promise.all(selectedActionIds.map((id) => axiosClient.put(`/users/${id}`, { isActive: true, lockReason: '' })));
      Swal.fire('Thành công', 'Đã mở khóa các tài khoản đã chọn!', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Không thể mở khóa hàng loạt!', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const result = await Swal.fire({
      title: `Xóa ${selectedCount} người dùng?`,
      text: 'Thao tác này không thể hoàn tác.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Xóa hàng loạt',
      cancelButtonText: 'Hủy',
    });
    if (!result.isConfirmed) return;

    try {
      await Promise.all(selectedActionIds.map((id) => axiosClient.delete(`/users/${id}`)));
      Swal.fire('Đã xóa', 'Các người dùng đã chọn đã được xóa.', 'success');
      fetchUsers();
    } catch {
      Swal.fire('Lỗi', 'Xóa hàng loạt thất bại!', 'error');
    }
  };

  const exportUsers = () => {
    const headers = ['Họ tên', 'Email', 'SĐT', 'Vai trò', 'Trạng thái', 'Ngày tạo'];
    const rows = visibleUsers.map((user) => [
      user.fullName || '',
      user.email || '',
      user.phone || 'Chưa cập nhật',
      getRoleLabel(user.role),
      user.isActive ? 'Hoạt động' : 'Đã khóa',
      formatDate(user.createdAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `arena-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statCards = [
    { label: 'Tổng người dùng', value: stats.total, desc: 'Tài khoản đang hiển thị', icon: Users, tone: 'emerald' },
    { label: 'Đang hoạt động', value: stats.active, desc: 'Có thể đăng nhập', icon: UserCheck, tone: 'green' },
    { label: 'Đã khóa', value: stats.locked, desc: 'Tài khoản bị hạn chế', icon: UserX, tone: 'red' },
    { label: 'Quản trị viên', value: stats.admins, desc: 'Có quyền quản lý', icon: ShieldCheck, tone: 'violet' },
    { label: 'Mới trong tháng', value: stats.newThisMonth, desc: 'Tạo trong tháng này', icon: CalendarPlus, tone: 'amber' },
  ];

  return (
    <div className="admin-users-page">
      <section className="admin-users-header">
        <div>
          <span className="admin-users-eyebrow">ArenaHub Admin</span>
          <h1>Quản lý người dùng</h1>
          <p>Theo dõi, phân quyền và quản lý tài khoản khách hàng trong hệ thống</p>
        </div>
        <div className="admin-users-header-actions">
          <Button className="admin-users-secondary-btn" onClick={exportUsers} disabled={visibleUsers.length === 0}>
            <Download size={18} />
            Xuất Excel
          </Button>
          <Button className="admin-users-primary-btn" onClick={() => openModal()}>
            <Plus size={18} />
            Thêm người dùng
          </Button>
        </div>
      </section>

      <section className="admin-users-stats-grid">
        {statCards.map((stat) => {
          const StatIcon = stat.icon;
          return (
          <article className={`admin-users-stat-card is-${stat.tone}`} key={stat.label}>
            <div className="admin-users-stat-icon">
              <StatIcon size={22} />
            </div>
            <div>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small>{stat.desc}</small>
            </div>
          </article>
          );
        })}
      </section>

      <section className="admin-users-filter-card">
        <div className="admin-users-search-field">
          <Search size={18} />
          <Form.Control
            value={search}
            placeholder="Tìm tên hoặc email..."
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Form.Select
          value={filterRole}
          onChange={(e) => {
            setFilterRole(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc vai trò"
        >
          <option value="all">Mọi vai trò</option>
          <option value="user">Khách hàng</option>
          <option value="admin">Admin</option>
          <option value="owner">Chủ sân</option>
        </Form.Select>
        <Form.Select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Đã khóa</option>
        </Form.Select>
        <Form.Control type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} aria-label="Lọc ngày tạo" />
        <Button className="admin-users-reset-btn" onClick={resetFilters}>
          <RotateCcw size={17} />
          Reset
        </Button>
      </section>

      {selectedCount > 0 && (
        <section className="admin-users-bulk-bar">
          <strong>Đã chọn {selectedCount} người dùng</strong>
          <div>
            <Button className="admin-users-bulk-lock" onClick={handleBulkLock}>
              <Lock size={16} />
              Khóa hàng loạt
            </Button>
            <Button className="admin-users-bulk-unlock" onClick={handleBulkUnlock}>
              <Unlock size={16} />
              Mở khóa hàng loạt
            </Button>
            <Button className="admin-users-bulk-delete" onClick={handleBulkDelete}>
              <Trash2 size={16} />
              Xóa hàng loạt
            </Button>
          </div>
        </section>
      )}

      <section className="admin-users-table-card">
        {fetching ? (
          <div className="admin-users-loading">
            <Spinner animation="border" />
            <span>Đang tải danh sách người dùng...</span>
          </div>
        ) : error ? (
          <div className="admin-users-empty">
            <UserX size={44} />
            <h3>Không thể tải dữ liệu</h3>
            <p>{error}</p>
            <Button className="admin-users-primary-btn" onClick={fetchUsers}>Thử lại</Button>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="admin-users-empty">
            <Users size={44} />
            <h3>Không tìm thấy người dùng phù hợp</h3>
            <p>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc hiện tại.</p>
            <Button className="admin-users-secondary-btn" onClick={resetFilters}>
              <RotateCcw size={17} />
              Reset bộ lọc
            </Button>
          </div>
        ) : (
          <>
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th className="admin-users-checkbox-cell">
                      <Form.Check checked={allVisibleSelected} onChange={toggleSelectAll} disabled={selectableUsers.length === 0} aria-label="Chọn tất cả" />
                    </th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>SĐT</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user._id}>
                      <td className="admin-users-checkbox-cell">
                        <Form.Check checked={!isProtectedAdmin(user) && selectedUsers.includes(user._id)} onChange={() => toggleSelectedUser(user)} disabled={isProtectedAdmin(user)} aria-label={`Chọn ${user.fullName}`} />
                      </td>
                      <td>
                        <div className="admin-users-person">
                          <UserAvatar user={user} />
                          <div className="admin-users-person-info">
                            <strong>{user.fullName || 'Chưa cập nhật'}</strong>
                            <span>{getRoleLabel(user.role)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="admin-users-email">{user.email}</td>
                      <td>{user.phone || <span className="admin-users-muted">Chưa cập nhật</span>}</td>
                      <td>
                        <span className={`admin-users-badge ${getRoleClass(user.role)}`}>{getRoleLabel(user.role)}</span>
                      </td>
                      <td>
                        <span className={`admin-users-badge ${user.isActive ? 'admin-users-status-active' : 'admin-users-status-locked'}`}>
                          {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="admin-users-actions">
                          <ActionButton label="Xem chi tiết" disabled={isProtectedAdmin(user)} onClick={() => openDetailModal(user)}>
                            <Eye size={16} />
                          </ActionButton>
                          <ActionButton label="Sửa" className="is-edit" disabled={isProtectedAdmin(user)} onClick={() => openModal(user)}>
                            <Edit size={16} />
                          </ActionButton>
                          <ActionButton label={user.isActive ? 'Khóa' : 'Mở khóa'} className={user.isActive ? 'is-lock' : 'is-unlock'} disabled={isProtectedAdmin(user)} onClick={() => (user.isActive ? handleLock(user) : toggleStatus(user))}>
                            {user.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                          </ActionButton>
                          <ActionButton label="Xóa" className="is-delete" disabled={isProtectedAdmin(user)} onClick={() => handleDelete(user)}>
                            <Trash2 size={16} />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination className="admin-users-pagination">
              {[...Array(totalPages)].map((_, index) => (
                <Pagination.Item key={index} active={index + 1 === page} onClick={() => setPage(index + 1)}>
                  {index + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          </>
        )}
      </section>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="admin-users-form-modal">
        <Modal.Header closeButton>
          <Modal.Title>{formData._id ? 'Cập nhật tài khoản' : 'Thêm mới người dùng'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Họ tên</Form.Label>
              <Form.Control value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Số điện thoại</Form.Label>
              <Form.Control value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </Form.Group>
            {!formData._id && (
              <Form.Group className="mb-3">
                <Form.Label>Mật khẩu</Form.Label>
                <Form.Control name="password" type="password" placeholder="Mặc định: Password@123" />
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Vai trò</Form.Label>
              <Form.Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                <option value="user">Khách hàng</option>
                <option value="owner">Chủ sân</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button className="admin-users-primary-btn" type="submit" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Lưu dữ liệu'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered size="lg" dialogClassName="admin-users-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết người dùng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailUser && (
            <div className="admin-users-detail">
              <div className="admin-users-detail-profile">
                <UserAvatar user={detailUser} large />
                <h2>{detailUser.fullName || 'Chưa cập nhật'}</h2>
                <p>{detailUser.email}</p>
                <span className={`admin-users-badge ${detailUser.isActive ? 'admin-users-status-active' : 'admin-users-status-locked'}`}>
                  {detailUser.isActive ? 'Hoạt động' : 'Đã khóa'}
                </span>
              </div>
              <div className="admin-users-detail-grid">
                <div>
                  <Mail size={18} />
                  <span>Email</span>
                  <strong>{detailUser.email || 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <Phone size={18} />
                  <span>SĐT</span>
                  <strong>{detailUser.phone || 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <span>Vai trò</span>
                  <strong>{getRoleLabel(detailUser.role)}</strong>
                </div>
                <div>
                  <CalendarDays size={18} />
                  <span>Ngày tạo</span>
                  <strong>{formatDate(detailUser.createdAt)}</strong>
                </div>
                <div>
                  <ClipboardList size={18} />
                  <span>Tổng đơn đặt sân</span>
                  <strong>{detailUser.totalBookings || detailUser.bookingCount || 0}</strong>
                </div>
                <div>
                  <Wallet size={18} />
                  <span>Tổng chi tiêu</span>
                  <strong>{formatCurrency(detailUser.totalSpent || detailUser.spent || 0)}</strong>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default UserManager;
