# So do hoat dong rut gon cho luan van

Thu muc nay chua cac so do PlantUML ban rut gon, phu hop de chen vao chuong phan tich thiet ke trong luan van.

Khac voi thu muc cha, cac so do o day chi giu cac buoc nghiep vu chinh, han che chi tiet ky thuat nhu populate, aggregate, socket event chi tiet, hoac cac bien the status phuc tap.

## Danh sach so do de chen vao luan van

- `01_dang_ky_dang_nhap.puml`: Dang ky, dang nhap va cap token.
- `02_quen_mat_khau_otp.puml`: Khoi phuc mat khau bang OTP.
- `03_tim_kiem_va_xem_san.puml`: Tim kiem san va xem chi tiet san.
- `04_dat_san_giu_cho.puml`: Chon slot, tao booking cho thanh toan va giu cho tam thoi 3 phut.
- `05_cap_nhat_booking_voucher_dich_vu.puml`: Them dich vu va ap dung voucher cho booking.
- `06_thanh_toan_vnpay.puml`: Kiem tra thoi gian giu cho, tao giao dich va xu ly ket qua VNPay.
- `07_huy_don_dat_san.puml`: Huy don va admin duyet huy.
- `08_quan_ly_lich_admin.puml`: Admin xem lich va doi lich.
- `09_lich_co_dinh.puml`: Tao va quan ly lich co dinh.
- `10_quan_ly_san_dich_vu.puml`: CRUD san va dich vu.
- `11_quan_ly_voucher.puml`: CRUD va kiem tra voucher.
- `12_danh_gia_san.puml`: Danh gia san sau khi booking hoan thanh.
- `13_lien_he_phan_hoi.puml`: Gui lien he va admin phan hoi.
- `14_tin_tuc_banner_chinh_sach.puml`: Quan ly noi dung hien thi.
- `15_chat_thong_bao_ai.puml`: Chat, thong bao va tro ly AI.
- `16_dashboard_bao_cao.puml`: Dashboard va bao cao doanh thu.
- `17_ai_chat_session.puml`: Luu lich su hoi dap AI bang model ChatSession.

## Goi y su dung

Chen cac so do chinh vao luan van:

1. `03_tim_kiem_va_xem_san.puml`
2. `04_dat_san_giu_cho.puml`
3. `06_thanh_toan_vnpay.puml`
4. `07_huy_don_dat_san.puml`
5. `08_quan_ly_lich_admin.puml`
6. `10_quan_ly_san_dich_vu.puml`
7. `16_dashboard_bao_cao.puml`

Render bang PlantUML extension hoac lenh:

```bash
plantuml Backend/so_do_hoat_dong/rut_gon_luan_van/*.puml
```
