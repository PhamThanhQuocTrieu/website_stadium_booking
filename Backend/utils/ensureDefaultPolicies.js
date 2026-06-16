const Policy = require('../models/Policy');

const defaultPolicies = [
  {
    type: 'terms',
    title: 'Điều khoản sử dụng',
    content: `
      <h2>Điều khoản sử dụng ArenaHub</h2>
      <h3>1. Quy định tài khoản</h3>
      <p>Người dùng cần cung cấp thông tin chính xác khi đăng ký và chịu trách nhiệm bảo mật tài khoản của mình.</p>
      <h3>2. Quy định đặt sân</h3>
      <p>Người dùng cần kiểm tra kỹ sân, ngày đặt, khung giờ và dịch vụ đi kèm trước khi xác nhận thanh toán.</p>
      <h3>3. Thanh toán</h3>
      <p>Các giao dịch thanh toán được xử lý qua cổng thanh toán được ArenaHub hỗ trợ. Đơn chỉ được xác nhận khi thanh toán thành công hoặc theo chính sách của sân.</p>
      <h3>4. Hủy sân</h3>
      <p>Yêu cầu hủy sân được xử lý theo trạng thái thanh toán và quy định duyệt hủy của quản trị viên.</p>
      <h3>5. Xử lý vi phạm</h3>
      <p>ArenaHub có quyền tạm khóa hoặc từ chối phục vụ tài khoản có hành vi gian lận, phá hoại hệ thống hoặc vi phạm quy định sử dụng.</p>
    `
  },
  {
    type: 'privacy',
    title: 'Chính sách bảo mật',
    content: `
      <h2>Chính sách bảo mật ArenaHub</h2>
      <h3>1. Thu thập dữ liệu</h3>
      <p>ArenaHub thu thập các thông tin cần thiết như họ tên, email, số điện thoại, lịch sử đặt sân và thông tin thanh toán liên quan đến giao dịch.</p>
      <h3>2. Mục đích sử dụng</h3>
      <p>Dữ liệu được dùng để xác thực tài khoản, xử lý đặt sân, thanh toán, chăm sóc khách hàng và cải thiện chất lượng dịch vụ.</p>
      <h3>3. Bảo mật dữ liệu</h3>
      <p>ArenaHub áp dụng các biện pháp kỹ thuật phù hợp để bảo vệ dữ liệu người dùng khỏi truy cập trái phép.</p>
      <h3>4. Quyền người dùng</h3>
      <p>Người dùng có quyền cập nhật thông tin cá nhân và liên hệ ArenaHub khi cần hỗ trợ về dữ liệu tài khoản.</p>
      <h3>5. Cam kết không bán dữ liệu cá nhân</h3>
      <p>ArenaHub không bán dữ liệu cá nhân của người dùng cho bên thứ ba.</p>
    `
  }
];

const ensureDefaultPolicies = async () => {
  await Promise.all(defaultPolicies.map(async (policy) => {
    await Policy.updateOne(
      { type: policy.type },
      { $setOnInsert: policy },
      { upsert: true }
    );
  }));
};

module.exports = ensureDefaultPolicies;
