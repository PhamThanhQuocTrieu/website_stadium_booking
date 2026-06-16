import React, { useMemo, useState } from 'react';
import { Accordion, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../api/axiosClient';
import '../styles/ContactPage.css';

const categoryOptions = [
  { value: 'booking_support', label: 'Hỗ trợ đặt sân' },
  { value: 'payment_support', label: 'Hỗ trợ thanh toán' },
  { value: 'cancel_request', label: 'Yêu cầu hủy sân' },
  { value: 'complaint', label: 'Khiếu nại / góp ý' },
  { value: 'system_error', label: 'Báo lỗi hệ thống' },
  { value: 'other', label: 'Khác' }
];

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  category: '',
  subject: '',
  message: ''
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

const ContactPage = () => {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const messageLength = useMemo(() => formData.message.trim().length, [formData.message]);

  const contactItems = [
    { icon: Phone, label: 'Hotline', value: '0389603429' },
    { icon: Mail, label: 'Email', value: 'arenahub@gmail.com' },
    { icon: MapPin, label: 'Địa chỉ', value: 'Trường Đại học Cần Thơ' },
    { icon: Clock, label: 'Giờ hoạt động', value: '06:00 - 22:00' }
  ];

  const supportSteps = [
    'Tiếp nhận yêu cầu và kiểm tra thông tin đặt sân.',
    'Đối soát thanh toán, lịch sân hoặc nội dung cần hỗ trợ.',
    'Phản hồi kết quả xử lý qua thông tin bạn đã cung cấp.'
  ];

  const faqItems = [
    {
      question: 'Tôi có thể hủy lịch đặt sân không?',
      answer: 'Bạn có thể gửi yêu cầu hủy trong mục lịch sử đặt sân hoặc liên hệ ArenaHub để được kiểm tra theo chính sách hủy hiện tại.'
    },
    {
      question: 'Sau khi thanh toán thì đơn đặt sân được xác nhận thế nào?',
      answer: 'Khi thanh toán thành công, hệ thống sẽ cập nhật trạng thái đơn và bạn có thể xem lại thông tin trong lịch sử đặt sân.'
    },
    {
      question: 'Nếu thanh toán lỗi thì tôi phải làm gì?',
      answer: 'Bạn hãy kiểm tra lại kết nối, trạng thái giao dịch và gửi liên hệ kèm mã đơn nếu cần ArenaHub hỗ trợ đối soát.'
    },
    {
      question: 'Tôi có thể đặt nhiều khung giờ cùng lúc không?',
      answer: 'Bạn có thể chọn các khung giờ còn trống theo sân và ngày mong muốn trước khi tạo đơn đặt sân.'
    },
    {
      question: 'Tôi có thể liên hệ hỗ trợ qua đâu?',
      answer: 'Bạn có thể gửi form liên hệ trên trang này hoặc liên hệ hotline 0389603429 trong khung giờ 06:00 - 22:00.'
    }
  ];

  const validateForm = () => {
    const nextErrors = {};
    const phone = formData.phone.trim().replace(/[\s.-]/g, '');

    if (!formData.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ và tên.';
    if (!emailRegex.test(formData.email.trim())) nextErrors.email = 'Email không đúng định dạng.';
    if (!phoneRegex.test(phone)) nextErrors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
    if (!formData.category) nextErrors.category = 'Vui lòng chọn loại yêu cầu.';
    if (!formData.subject.trim()) nextErrors.subject = 'Vui lòng nhập chủ đề.';
    if (formData.message.trim().length < 10) nextErrors.message = 'Nội dung cần tối thiểu 10 ký tự.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim().replace(/[\s.-]/g, ''),
        subject: formData.subject.trim(),
        message: formData.message.trim()
      };
      const { data } = await axiosClient.post('/contacts', payload);
      await Swal.fire({
        icon: 'success',
        title: 'Gửi liên hệ thành công',
        text: data?.message || 'Chúng tôi sẽ phản hồi bạn sớm nhất.',
        confirmButtonColor: '#15803d'
      });
      setFormData(initialForm);
      setErrors({});
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể gửi liên hệ',
        text: error.response?.data?.message || 'Vui lòng kiểm tra thông tin và thử lại.',
        confirmButtonColor: '#15803d'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <Container className="contact-container">
          <div className="contact-hero-content">
            <span className="contact-hero-line" aria-hidden="true" />
            <div>
              <h1>Liên hệ với chúng tôi</h1>
              <p>
                Chúng tôi luôn sẵn sàng hỗ trợ bạn trong quá trình đặt sân, thanh toán
                và sử dụng dịch vụ tại ArenaHub.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <Container className="contact-container contact-main">
        <Row className="g-4 align-items-stretch">
          <Col lg={4}>
            <section className="contact-card contact-info-card">
              <div className="contact-card-title">
                <MessageCircle size={20} />
                <h2>Thông tin liên hệ</h2>
              </div>

              <div className="contact-info-list">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="contact-info-item" key={item.label}>
                      <span className="contact-info-icon"><Icon size={20} /></span>
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="contact-support-panel">
                <div className="contact-support-heading">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Hỗ trợ trong ngày</strong>
                    <span>Ưu tiên các vấn đề đặt sân và thanh toán</span>
                  </div>
                </div>
                <div className="contact-support-meta">
                  <div>
                    <strong>15-30 phút</strong>
                    <span>Thời gian phản hồi dự kiến</span>
                  </div>
                  <div>
                    <strong>06:00-22:00</strong>
                    <span>Khung giờ xử lý yêu cầu</span>
                  </div>
                </div>
              </div>

              <div className="contact-process-box">
                <h3>Quy trình hỗ trợ</h3>
                <ul>
                  {supportSteps.map((step) => (
                    <li key={step}>
                      <CheckCircle2 size={16} />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </Col>

          <Col lg={8}>
            <section className="contact-card contact-form-card">
              <div className="contact-card-title">
                <Send size={20} />
                <h2>Gửi yêu cầu liên hệ</h2>
              </div>

              <Form noValidate onSubmit={handleSubmit}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Họ và tên <span>*</span></Form.Label>
                      <Form.Control
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        isInvalid={!!errors.fullName}
                        placeholder="Nhập họ và tên của bạn"
                      />
                      <Form.Control.Feedback type="invalid">{errors.fullName}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email <span>*</span></Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        isInvalid={!!errors.email}
                        placeholder="Nhập địa chỉ email"
                      />
                      <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Số điện thoại <span>*</span></Form.Label>
                      <Form.Control
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        isInvalid={!!errors.phone}
                        placeholder="Nhập số điện thoại"
                      />
                      <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Loại yêu cầu <span>*</span></Form.Label>
                      <Form.Select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        isInvalid={!!errors.category}
                      >
                        <option value="">Chọn loại yêu cầu</option>
                        {categoryOptions.map((option) => (
                          <option value={option.value} key={option.value}>{option.label}</option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">{errors.category}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col xs={12}>
                    <Form.Group>
                      <Form.Label>Chủ đề <span>*</span></Form.Label>
                      <Form.Control
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        isInvalid={!!errors.subject}
                        placeholder="Nhập chủ đề liên hệ"
                      />
                      <Form.Control.Feedback type="invalid">{errors.subject}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col xs={12}>
                    <Form.Group>
                      <Form.Label>Nội dung <span>*</span></Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={5}
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        isInvalid={!!errors.message}
                        maxLength={1000}
                        placeholder="Nhập nội dung chi tiết (tối thiểu 10 ký tự)..."
                      />
                      <div className="contact-message-meta">
                        <Form.Control.Feedback type="invalid">{errors.message}</Form.Control.Feedback>
                        <span>{messageLength} / 1000</span>
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="contact-form-footer">
                  <p><ShieldCheck size={15} /> Thông tin của bạn sẽ được bảo mật và chỉ sử dụng để hỗ trợ.</p>
                  <Button type="submit" className="contact-submit-btn" disabled={submitting}>
                    {submitting ? <Spinner animation="border" size="sm" /> : <><Send size={17} /> Gửi liên hệ</>}
                  </Button>
                </div>
              </Form>
            </section>
          </Col>
        </Row>

        <section className="contact-card contact-faq-card">
          <div className="contact-card-title">
            <MessageCircle size={20} />
            <h2>Câu hỏi thường gặp</h2>
          </div>
          <Accordion className="contact-faq" alwaysOpen>
            {faqItems.map((item, index) => (
              <Accordion.Item eventKey={String(index)} key={item.question}>
                <Accordion.Header>{item.question}</Accordion.Header>
                <Accordion.Body>{item.answer}</Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </section>
      </Container>
    </div>
  );
};

export default ContactPage;
