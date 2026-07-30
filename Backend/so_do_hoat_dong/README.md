# So do hoat dong Backend

Thu muc nay chua cac so do hoat dong PlantUML duoc ve dua tren routes, controllers, services va models cua Backend.

## Danh sach file

- `00_tong_quan_backend_activity.puml`: luong xu ly tong quan tu client den Express, middleware, controller, database va socket.
- `01_xac_thuc_nguoi_dung.puml`: dang ky, dang nhap, Google login, quen mat khau bang OTP va quan ly user.
- `02_dat_san_va_giu_cho.puml`: xem trang thai san, giu slot 3 phut va tao booking pending.
- `03_cap_nhat_don_voucher_dich_vu.puml`: cap nhat dich vu, tru/hoan kho va ap dung voucher.
- `04_thanh_toan_vnpay.puml`: tao URL thanh toan, return URL va IPN tu VNPay.
- `05_huy_don_va_duyet_huy.puml`: nguoi dung huy/yeu cau huy va admin duyet/tu choi huy.
- `06_quan_ly_lich_admin.puml`: xem lich, doi lich, tao/kiem tra/huy/cap nhat lich co dinh.
- `07_quan_tri_noi_dung_va_bao_cao.puml`: CRUD san, dich vu, voucher, tin tuc, banner, chinh sach, lien he, danh gia, bao cao.
- `08_chat_thong_bao_ai.puml`: chat user-admin, thong bao realtime va AI chat.
- `09_quan_ly_san_va_dich_vu.puml`: admin quan ly san, bang gia, bao tri va dich vu/tien ich.
- `10_danh_gia_san_dich_vu.puml`: user danh gia sau booking, admin an/hien review va cap nhat diem san.
- `11_lien_he_va_phan_hoi.puml`: user gui lien he, admin loc, cap nhat trang thai va phan hoi.
- `12_tin_tuc_banner_chinh_sach.puml`: luong quan tri tin tuc, banner trang chu va chinh sach dieu khoan.
- `13_dashboard_bao_cao_doanh_thu.puml`: tong hop dashboard va bao cao doanh thu bang aggregation.
- `14_thong_bao_he_thong.puml`: user xem thong bao, admin gui thong bao he thong/khuyen mai.
- `15_tim_kiem_san_nguoi_dung.puml`: user loc danh sach san, tinh slot trong ngay va xem chi tiet san.
- `16_ai_chat_session.puml`: luong tao, luu, doc va xoa lich su ChatSession cho tro ly AI.

Co the render bang PlantUML extension trong VS Code/IntelliJ hoac lenh:

```bash
plantuml Backend/so_do_hoat_dong/*.puml
```
