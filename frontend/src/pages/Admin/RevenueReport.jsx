import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Filter,
  Percent,
  RefreshCw,
  Search,
  Trophy,
  Users,
  WalletCards
} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import '../../styles/admin/revenue-report.css';

const defaultFilters = {
  startDate: '',
  endDate: '',
  month: '',
  field: '',
  fieldType: '',
  paymentStatus: '',
  search: '',
  sortBy: 'date',
  sortOrder: 'desc'
};

const emptyReport = {
  summary: {},
  charts: { topFields: [], topHours: [], topCustomers: [], revenueTrend: [] },
  rows: [],
  pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
  options: { fields: [], fieldTypes: [] }
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const paymentLabels = {
  pending: 'Chờ thanh toán',
  unpaid: 'Chưa thanh toán',
  deposit: 'Đã đặt cọc',
  paid: 'Đã thanh toán',
  success: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  refunded: 'Hoàn tiền',
  cancelled: 'Hủy'
};

const getPaymentLabel = (status, bookingStatus) => {
  if (['cancelled', 'canceled'].includes(normalize(bookingStatus))) return 'Hủy';
  return paymentLabels[normalize(status)] || status || 'Chưa cập nhật';
};

const getPaymentTone = (status, bookingStatus) => {
  const key = normalize(status);
  const bookingKey = normalize(bookingStatus);
  if (['cancelled', 'canceled'].includes(bookingKey)) return 'danger';
  if (['paid', 'success'].includes(key)) return 'success';
  if (['pending', 'unpaid', 'deposit'].includes(key)) return 'warning';
  if (key === 'refunded') return 'neutral';
  if (['failed', 'cancelled'].includes(key)) return 'danger';
  return 'neutral';
};

const toCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildExportRows = (rows) => [
  ['Mã đặt sân', 'Tên khách hàng', 'Sân', 'Loại sân', 'Ngày đặt', 'Khung giờ', 'Tổng tiền', 'Trạng thái thanh toán'],
  ...rows.map((row) => [
    row.bookingCode,
    row.customerName,
    row.fieldName,
    row.fieldType,
    row.date,
    row.timeRange,
    row.totalAmount,
    getPaymentLabel(row.paymentStatus, row.bookingStatus)
  ])
];

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SkeletonBlock = ({ className = '' }) => <div className={`revenue-report-skeleton ${className}`} />;

const EmptyState = ({ title = 'Chưa có dữ liệu', text = 'Hãy thử điều chỉnh bộ lọc hoặc khoảng thời gian.' }) => (
  <div className="revenue-report-empty">
    <AlertCircle size={34} />
    <strong>{title}</strong>
    <span>{text}</span>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="revenue-report-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          {entry.name}: {entry.dataKey === 'revenue' ? formatCurrency(entry.value) : formatNumber(entry.value)}
        </span>
      ))}
    </div>
  );
};

const StatCard = ({ icon, label, value, hint, tone, loading }) => (
  <article className="revenue-report-stat">
    {loading ? (
      <>
        <SkeletonBlock className="skeleton-icon" />
        <SkeletonBlock className="skeleton-line" />
        <SkeletonBlock className="skeleton-value" />
      </>
    ) : (
      <>
        <span className={`revenue-report-stat-icon ${tone}`}>{icon}</span>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </>
    )}
  </article>
);

const ChartPanel = ({ title, icon, children }) => (
  <section className="revenue-report-panel">
    <div className="revenue-report-panel-head">
      <div>
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
    </div>
    {children}
  </section>
);

const RevenueReport = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const buildParams = useCallback((override = {}) => {
    const params = {};
    Object.entries({ ...filters, ...override }).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    params.page = override.page || page;
    params.limit = override.limit || limit;
    return params;
  }, [filters, page, limit]);

  const fetchReport = useCallback(async (override = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/admin/reports/revenue', { params: buildParams(override) });
      setReport({
        ...emptyReport,
        ...data,
        charts: { ...emptyReport.charts, ...(data.charts || {}) },
        options: { ...emptyReport.options, ...(data.options || {}) }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải báo cáo doanh thu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'month' && value) {
        next.startDate = '';
        next.endDate = '';
      }
      if ((key === 'startDate' || key === 'endDate') && value) next.month = '';
      return next;
    });
  };

  const handleLimitChange = (value) => {
    setPage(1);
    setLimit(Number(value));
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (page === 1) fetchReport();
    else setPage(1);
  };

  const handleExport = async (type) => {
    try {
      const { data } = await axiosClient.get('/admin/reports/revenue', {
        params: buildParams({ page: 1, limit: 5000, export: true })
      });
      const exportRows = buildExportRows(data.rows || []);
      const timestamp = new Date().toISOString().slice(0, 10);

      if (type === 'csv') {
        const csv = `\uFEFF${exportRows.map((row) => row.map(toCsvCell).join(',')).join('\n')}`;
        downloadBlob(csv, `bao-cao-doanh-thu-${timestamp}.csv`, 'text/csv;charset=utf-8;');
        return;
      }

      const escapeXml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      const excelRows = exportRows
        .map((row, rowIndex) => {
          const styleId = rowIndex === 0 ? 'Header' : 'Text';
          const cells = row.map((cell, cellIndex) => {
            if (rowIndex > 0 && cellIndex === 6) {
              return `<Cell ss:StyleID="Amount"><Data ss:Type="Number">${Number(cell || 0)}</Data></Cell>`;
            }
            return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
          }).join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');
      const xls = `<?xml version="1.0" encoding="UTF-8"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook
          xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
          <Styles>
            <Style ss:ID="Text">
              <Font ss:FontName="Arial" ss:Size="11" />
              <Alignment ss:Vertical="Center" />
              <Borders>
                <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B" />
                <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B" />
                <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B" />
                <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#64748B" />
              </Borders>
            </Style>
            <Style ss:ID="Header">
              <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF" />
              <Interior ss:Color="#16A34A" ss:Pattern="Solid" />
              <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
              <Borders>
                <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155" />
                <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155" />
                <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155" />
                <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155" />
              </Borders>
            </Style>
            <Style ss:ID="Amount" ss:Parent="Text">
              <Alignment ss:Horizontal="Right" ss:Vertical="Center" />
              <NumberFormat ss:Format="#,##0" />
            </Style>
          </Styles>
          <Worksheet ss:Name="Bao cao doanh thu">
            <Table>
              <Column ss:Width="90" />
              <Column ss:Width="150" />
              <Column ss:Width="160" />
              <Column ss:Width="110" />
              <Column ss:Width="95" />
              <Column ss:Width="110" />
              <Column ss:Width="105" />
              <Column ss:Width="150" />
              ${excelRows}
            </Table>
          </Worksheet>
        </Workbook>`;
      downloadBlob(xls, `bao-cao-doanh-thu-${timestamp}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    } catch (err) {
      setError('Không thể xuất báo cáo. Vui lòng thử lại.');
    }
  };

  const summary = report.summary || {};
  const pagination = report.pagination || emptyReport.pagination;
  const rows = report.rows || [];
  const charts = report.charts || emptyReport.charts;

  const statCards = useMemo(() => [
    {
      label: 'Tổng doanh thu',
      value: formatCurrency(summary.totalRevenue),
      hint: 'Từ các đơn đã thanh toán',
      icon: <CircleDollarSign size={22} />,
      tone: 'green'
    },
    {
      label: 'Tổng lượt đặt sân',
      value: formatNumber(summary.totalBookings),
      hint: 'Theo bộ lọc hiện tại',
      icon: <CalendarDays size={22} />,
      tone: 'blue'
    },
    {
      label: 'Đơn đã thanh toán',
      value: formatNumber(summary.paidBookings),
      hint: 'Đã ghi nhận thanh toán thành công',
      icon: <WalletCards size={22} />,
      tone: 'cyan'
    },
    {
      label: 'Đơn chưa thanh toán',
      value: formatNumber(summary.unpaidBookings),
      hint: 'Đang chờ hoặc chưa hoàn tất',
      icon: <AlertCircle size={22} />,
      tone: 'neutral'
    },
    {
      label: 'Doanh thu trung bình',
      value: formatCurrency(summary.averageRevenuePerBooking),
      hint: 'Trên mỗi lượt đã thanh toán',
      icon: <Trophy size={22} />,
      tone: 'amber'
    },
    {
      label: 'Tỷ lệ thanh toán thành công',
      value: `${Number(summary.paymentSuccessRate || 0).toFixed(1)}%`,
      hint: 'Đơn đã thanh toán / tổng đơn',
      icon: <Percent size={22} />,
      tone: 'purple'
    },
    {
      label: 'Hoàn tiền / Hủy',
      value: `${formatNumber(summary.refundedBookings)} / ${formatNumber(summary.cancelledBookings)}`,
      hint: 'Theo trạng thái trong hệ thống',
      icon: <RefreshCw size={22} />,
      tone: 'neutral'
    }
  ], [summary]);

  return (
    <div className="revenue-report-page">
      <header className="revenue-report-header">
        <div>
          <p>Báo cáo doanh thu</p>
          <h1>Doanh thu nâng cao</h1>
          <span>Theo dõi doanh thu, khách hàng, khung giờ và hiệu quả thanh toán.</span>
        </div>
        <div className="revenue-report-actions">
          <button type="button" onClick={() => fetchReport()} disabled={loading}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button type="button" onClick={() => handleExport('csv')} disabled={loading || rows.length === 0}>
            <Download size={16} /> CSV
          </button>
          <button type="button" onClick={() => handleExport('xls')} disabled={loading || rows.length === 0}>
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </header>

      <form className="revenue-report-filters" onSubmit={handleSearchSubmit}>
        <div className="filter-title"><Filter size={18} /><strong>Bộ lọc</strong></div>
        <label><span>Từ ngày</span><input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} /></label>
        <label><span>Theo tháng</span><input type="month" value={filters.month} onChange={(event) => updateFilter('month', event.target.value)} /></label>
        <label>
          <span>Sân</span>
          <select value={filters.field} onChange={(event) => updateFilter('field', event.target.value)}>
            <option value="">Tất cả sân</option>
            {report.options.fields.map((field) => <option key={field._id} value={field._id}>{field.fieldName}</option>)}
          </select>
        </label>
        <label>
          <span>Loại sân</span>
          <select value={filters.fieldType} onChange={(event) => updateFilter('fieldType', event.target.value)}>
            <option value="">Tất cả loại sân</option>
            {report.options.fieldTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          <span>Thanh toán</span>
          <select value={filters.paymentStatus} onChange={(event) => updateFilter('paymentStatus', event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="refunded">Hoàn tiền</option>
            <option value="cancelled">Hủy</option>
          </select>
        </label>
        <label>
          <span>Sắp xếp</span>
          <select value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value)}>
            <option value="date">Ngày đặt</option>
            <option value="revenue">Doanh thu</option>
            <option value="customer">Khách hàng</option>
          </select>
        </label>
        <label>
          <span>Thứ tự</span>
          <select value={filters.sortOrder} onChange={(event) => updateFilter('sortOrder', event.target.value)}>
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
        </label>
        <label className="search-field">
          <span>Tìm kiếm</span>
          <div>
            <Search size={16} />
            <input value={filters.search} placeholder="Tên khách hàng hoặc mã đặt sân" onChange={(event) => updateFilter('search', event.target.value)} />
          </div>
        </label>
        <button type="submit" className="filter-submit"><Search size={16} /> Tìm</button>
      </form>

      {error && <div className="revenue-report-error"><AlertCircle size={18} /> {error}</div>}

      <section className="revenue-report-stats">
        {statCards.map((item) => <StatCard key={item.label} {...item} loading={loading} />)}
      </section>

      <section className="revenue-report-grid two-columns">
        <ChartPanel title="Doanh thu theo thời gian" icon={<CircleDollarSign size={18} />}>
          {loading ? <SkeletonBlock className="skeleton-chart" /> : charts.revenueTrend.length ? (
            <div className="revenue-report-chart">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={charts.revenueTrend} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line name="Doanh thu" type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartPanel>

        <ChartPanel title="Top sân doanh thu cao nhất" icon={<Trophy size={18} />}>
          {loading ? <SkeletonBlock className="skeleton-chart" /> : charts.topFields.length ? (
            <div className="revenue-report-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.topFields} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="fieldName" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-12} height={62} />
                  <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar name="Doanh thu" dataKey="revenue" fill="#2563eb" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartPanel>
      </section>

      <section className="revenue-report-grid two-columns">
        <ChartPanel title="Khung giờ bán chạy nhất" icon={<CalendarDays size={18} />}>
          {loading ? <SkeletonBlock className="skeleton-chart" /> : charts.topHours.length ? (
            <div className="revenue-report-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.topHours} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar name="Lượt đặt" dataKey="bookings" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartPanel>

        <ChartPanel title="Khách hàng chi nhiều nhất" icon={<Users size={18} />}>
          {loading ? <SkeletonBlock className="skeleton-chart" /> : charts.topCustomers.length ? (
            <div className="revenue-report-ranking">
              {charts.topCustomers.map((customer, index) => (
                <article key={`${customer.customerName}-${index}`}>
                  <span>{index + 1}</span>
                  <div><strong>{customer.customerName}</strong><small>{customer.email || `${formatNumber(customer.bookings)} lượt đặt`}</small></div>
                  <b>{formatCurrency(customer.revenue)}</b>
                </article>
              ))}
            </div>
          ) : <EmptyState />}
        </ChartPanel>
      </section>

      <section className="revenue-report-panel revenue-report-table-panel">
        <div className="revenue-report-panel-head">
          <div><span><WalletCards size={18} /></span><h2>Chi tiết doanh thu</h2></div>
          <label className="table-limit">
            <span>Hiển thị</span>
            <select value={limit} onChange={(event) => handleLimitChange(event.target.value)}>
              <option value="10">10 dòng</option>
              <option value="20">20 dòng</option>
              <option value="50">50 dòng</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="revenue-report-table-loading">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="skeleton-row" />)}
          </div>
        ) : rows.length ? (
          <>
            <div className="revenue-report-table-wrap">
              <table className="revenue-report-table">
                <thead>
                  <tr>
                    <th>Mã đặt sân</th><th>Tên khách hàng</th><th>Sân</th><th>Loại sân</th>
                    <th>Ngày đặt</th><th>Khung giờ</th><th>Tổng tiền</th><th>Trạng thái thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id}>
                      <td data-label="Mã đặt sân"><strong>#{row.bookingCode}</strong></td>
                      <td data-label="Tên khách hàng">{row.customerName}</td>
                      <td data-label="Sân">{row.fieldName}</td>
                      <td data-label="Loại sân">{row.fieldType || '-'}</td>
                      <td data-label="Ngày đặt">{formatDate(row.date)}</td>
                      <td data-label="Khung giờ">{row.timeRange || '-'}</td>
                      <td data-label="Tổng tiền">{formatCurrency(row.totalAmount)}</td>
                      <td data-label="Trạng thái thanh toán">
                        <span className={`payment-pill ${getPaymentTone(row.paymentStatus, row.bookingStatus)}`}>
                          {getPaymentLabel(row.paymentStatus, row.bookingStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="revenue-report-pagination">
              <span>Tổng {formatNumber(pagination.total)} dòng, trang {pagination.page}/{pagination.totalPages}</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}><ChevronLeft size={16} /> Trước</button>
                <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((prev) => prev + 1)}>Sau <ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Không có dòng doanh thu" text="Không tìm thấy booking phù hợp với bộ lọc hiện tại." />
        )}
      </section>
    </div>
  );
};

export default RevenueReport;
