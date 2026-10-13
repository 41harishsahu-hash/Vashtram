import React, { useState } from 'react';
import { useCart } from '../context/useCart';
import { Phone, Mail, MapPin, Send, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { validateContactForm, sanitizePhoneInput } from '../utils/validationHelper';
import { useSettings } from '../context/useSettings';

const ContactPage = () => {
  const { showToast } = useCart();
  const { settings, storeName, supportEmail, supportPhone, storeAddress, whatsappNumber, getWhatsAppUrl } = useSettings();
  const phone = supportPhone || settings?.supportPhone || whatsappNumber || settings?.whatsappNumber || '+91 7691841583';
  const email = supportEmail || settings?.supportEmail || 'vashtramclothsy.info@gmail.com';
  const address = storeAddress || settings?.storeAddress || 'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021';
  const storeTitle = storeName || settings?.storeName || 'VASHTRAM';
  const brandName = storeTitle.includes(' ') && storeTitle.length > 20 ? storeTitle.split(' ')[0] : storeTitle;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmittedEmail, setLastSubmittedEmail] = useState('');

  const handleChange = (field, value) => {
    let finalValue = value;
    if (field === 'phone') {
      finalValue = sanitizePhoneInput(value);
    }

    const updatedForm = { ...formData, [field]: finalValue };
    setFormData(updatedForm);

    // Live validation if field has already been touched
    if (touched[field]) {
      const { errors: newErrors } = validateContactForm(updatedForm);
      setErrors((prev) => ({
        ...prev,
        [field]: newErrors[field] || '',
      }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const { errors: newErrors } = validateContactForm(formData);
    setErrors((prev) => ({
      ...prev,
      [field]: newErrors[field] || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { errors: validationErrors, isValid } = validateContactForm(formData);

    if (!isValid) {
      setErrors(validationErrors);
      setTouched({
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
      });
      showToast('Please fix the highlighted errors before submitting.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/inquiries', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });

      if (res.data?.success) {
        setLastSubmittedEmail(formData.email.trim());
        setSubmitted(true);
        setErrors({});
        setTouched({});
        showToast(res.data.message || 'Your inquiry has been sent! Our team will get back to you within 24 hours.');
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit inquiry. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 'clamp(24px, 4vw, 40px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 4vw, 48px)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}
          >
            We Are Here to Assist You
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.88rem, 2vw, 1rem)', maxWidth: '540px', margin: '0 auto' }}>
            Have questions about mattress protector sizing, waterproofing, custom bulk orders, or your delivery? Reach out anytime.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr',
            gap: 'clamp(20px, 3.5vw, 40px)',
            alignItems: 'start',
          }}
          className="contact-grid"
        >
          {/* Left: Contact Info Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Phone size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Call or WhatsApp</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>
                  <a
                    href={getWhatsAppUrl(`Hello ${brandName}, I have a query regarding VASHTRAM products.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {phone}
                  </a>
                </p>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Mon – Sat, 10:00 AM – 7:00 PM IST • Direct WhatsApp Available
                </span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Mail size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Customer Care Email</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                  <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a>
                </p>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  We respond within 24 business hours
                </span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MapPin size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Head Office</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {address}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Message Form */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 'clamp(18px, 3.5vw, 32px)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            {submitted ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#E6F4EA',
                    color: '#137333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle size={36} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Inquiry Sent Successfully!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '380px', lineHeight: 1.6 }}>
                  Thank you for reaching out to {brandName}. We have received your inquiry and our customer support team will get back to you within 24 hours
                  {lastSubmittedEmail ? ` at ${lastSubmittedEmail}` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="btn btn-secondary btn-md"
                  style={{ marginTop: '12px' }}
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px' }}>
                  Send Us a Message
                </h2>

                <form
                  onSubmit={handleSubmit}
                  noValidate
                  autoComplete="off"
                  className="contact-form"
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Your Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Type Your Name"
                      value={formData.name}
                      maxLength={50}
                      autoComplete="off"
                      onChange={(e) => handleChange('name', e.target.value)}
                      onBlur={() => handleBlur('name')}
                      style={
                        touched.name && errors.name
                          ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                          : {}
                      }
                    />
                    {touched.name && errors.name && (
                      <span
                        style={{
                          color: '#D93025',
                          fontSize: '0.78rem',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertCircle size={13} /> {errors.name}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="contact-form-row">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="contact_email"
                        placeholder="name@example.com"
                        value={formData.email}
                        autoComplete="off"
                        onChange={(e) => handleChange('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        style={
                          touched.email && errors.email
                            ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                            : {}
                        }
                      />
                      {touched.email && errors.email && (
                        <span
                          style={{
                            color: '#D93025',
                            fontSize: '0.78rem',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertCircle size={13} /> {errors.email}
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                        Phone Number <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="10-digit mobile number"
                        value={formData.phone}
                        maxLength={10}
                        autoComplete="off"
                        onChange={(e) => handleChange('phone', e.target.value)}
                        onBlur={() => handleBlur('phone')}
                        style={
                          touched.phone && errors.phone
                            ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                            : {}
                        }
                      />
                      {touched.phone && errors.phone && (
                        <span
                          style={{
                            color: '#D93025',
                            fontSize: '0.78rem',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertCircle size={13} /> {errors.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Subject *
                    </label>
                    <input
                      type="text"
                      name="subject"
                      placeholder="e.g. Question about King size dimensions"
                      value={formData.subject}
                      maxLength={150}
                      autoComplete="off"
                      onChange={(e) => handleChange('subject', e.target.value)}
                      onBlur={() => handleBlur('subject')}
                      style={
                        touched.subject && errors.subject
                          ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                          : {}
                      }
                    />
                    {touched.subject && errors.subject && (
                      <span
                        style={{
                          color: '#D93025',
                          fontSize: '0.78rem',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertCircle size={13} /> {errors.subject}
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Message *
                      </label>
                      <span style={{ fontSize: '0.74rem', color: formData.message.length > 2900 ? '#D93025' : 'var(--text-muted)' }}>
                        {formData.message.length} / 500 chars (min. 10)
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="How can we assist you? (Please provide at least 10 characters)"
                      value={formData.message}
                      maxLength={500}
                      onChange={(e) => handleChange('message', e.target.value)}
                      onBlur={() => handleBlur('message')}
                      style={
                        touched.message && errors.message
                          ? { borderColor: '#D93025', boxShadow: '0 0 0 1px #D93025' }
                          : {}
                      }
                    />
                    {touched.message && errors.message && (
                      <span
                        style={{
                          color: '#D93025',
                          fontSize: '0.78rem',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertCircle size={13} /> {errors.message}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary btn-lg"
                    style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Sending Inquiry...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Send Inquiry
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        /* Suppress unwanted browser autofill styling */
        .contact-form input:-webkit-autofill,
        .contact-form input:-webkit-autofill:hover,
        .contact-form input:-webkit-autofill:focus,
        .contact-form textarea:-webkit-autofill {
          -webkit-box-shadow: 0 0 0px 1000px var(--bg-card, #ffffff) inset !important;
          -webkit-text-fill-color: var(--text-primary, #1F1D1A) !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
          }
          .contact-form-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ContactPage;
