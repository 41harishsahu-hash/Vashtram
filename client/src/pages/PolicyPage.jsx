import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/useSettings';

// ---------------------------------------------------------------------------
// EDIT THESE VALUES to match how your business really works.
// ---------------------------------------------------------------------------
const POLICY_CONFIG = {
  lastUpdated: 'October 2026',
  dispatchTime: '1-2 business days', // time to pack and hand over to courier
  deliveryTime: '4-7 business days', // time after dispatch
  refundTime: '5-7 business days', // after the return/cancellation is approved
  damageReportWindow: '48 hours', // how long after delivery customer can report damage
};

const POLICY_LINKS = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/shipping-policy', label: 'Shipping Policy' },
  { to: '/return-policy', label: 'Returns & Refunds' },
];

const PolicyPage = ({ type }) => {
  const { settings, storeName, supportEmail, supportPhone, storeAddress } = useSettings();

  const brand = 'VASHTRAM';
  const legalName = storeName || 'VASHTRAM Mattress Protectors';
  const email = supportEmail || settings?.supportEmail || 'vashtramclothsy.info@gmail.com';
  const phone = supportPhone || settings?.supportPhone || '+91 7691841583';
  const address =
    storeAddress ||
    settings?.storeAddress ||
    'D-482 Jagdamba Nagar, Ajmer Road, Dhawas, Heerapura, Jaipur, Rajasthan, 302021';

  const threshold = Number(settings?.freeShippingThreshold ?? 999);
  const shippingFee = Number(settings?.standardShippingFee ?? 99);
  const returnDays = Number(settings?.returnDays ?? 7);
  const returnsEnabled = settings?.enableReturns !== false;

  const contactBlock = [
    `Email: ${email}`,
    `Phone / WhatsApp: ${phone}`,
    `Address: ${address}`,
  ];

  const pages = {
    privacy: {
      title: 'Privacy Policy',
      intro: `This Privacy Policy explains how ${legalName} ("${brand}", "we", "us") collects, uses and protects your information when you use our website and place orders with us.`,
      sections: [
        {
          heading: 'Information we collect',
          list: [
            'Account details: your name, email address, phone number and password (stored in encrypted form).',
            'Order details: shipping address, items ordered, order history and delivery status.',
            'Messages you send us through the contact form, email or WhatsApp.',
            'Basic technical data such as browser type, needed to keep the website working.',
          ],
        },
        {
          heading: 'Payments',
          paras: [
            'All online payments are processed securely by Razorpay. We do not see or store your card number, CVV, UPI PIN or net banking credentials. We only receive a payment confirmation and a payment reference from Razorpay.',
          ],
        },
        {
          heading: 'How we use your information',
          list: [
            'To process and deliver your orders and send order updates.',
            'To provide customer support and respond to your enquiries.',
            'To process returns, refunds and cancellations.',
            'To keep our website secure and prevent fraud or misuse.',
          ],
        },
        {
          heading: 'Sharing of information',
          paras: [
            'We do not sell your personal information. We share only what is needed with trusted service providers who help us run the store, such as the payment gateway (Razorpay), courier and delivery partners, and image/hosting services. We may also disclose information if required by law.',
          ],
        },
        {
          heading: 'Cookies and browser storage',
          paras: [
            'We store small pieces of data in your browser, such as your login session, your shopping cart and your theme preference, so the website works properly. You can clear this data from your browser settings at any time, but you may need to log in again.',
          ],
        },
        {
          heading: 'Data retention and security',
          paras: [
            'We keep your information only as long as needed to provide our services, handle returns and meet legal and accounting requirements. We use reasonable technical and organisational measures to protect your data, but no online system can be guaranteed to be completely secure.',
          ],
        },
        {
          heading: 'Your choices',
          paras: [
            `You can view and update your name, phone number and password from your Account page. To request a copy, correction or deletion of your personal data, contact us at ${email}. We will respond within a reasonable time, subject to any records we must keep by law.`,
          ],
        },
        {
          heading: "Children's privacy",
          paras: [
            'Our website is meant for adults. We do not knowingly collect personal information from children.',
          ],
        },
        {
          heading: 'Changes to this policy',
          paras: [
            'We may update this policy from time to time. The latest version will always be available on this page with the date it was last updated.',
          ],
        },
        { heading: 'Contact us', list: contactBlock },
      ],
    },

    terms: {
      title: 'Terms & Conditions',
      intro: `By using this website and placing an order with ${legalName}, you agree to the following terms. Please read them carefully.`,
      sections: [
        {
          heading: 'About us',
          paras: [`This website is operated by ${legalName}, ${address}.`],
        },
        {
          heading: 'Products and prices',
          paras: [
            'All prices are shown in Indian Rupees (INR). We try to keep product details, images and prices accurate, but errors can happen. Colours may look slightly different on different screens. If a product is listed at a wrong price or is out of stock, we may cancel the order and refund the full amount you paid.',
          ],
        },
        {
          heading: 'Placing an order',
          paras: [
            'An order is confirmed only after your payment is successfully received. We may refuse or cancel an order in cases such as unavailable stock, payment failure, suspected fraud or an incomplete delivery address. If we cancel a paid order, you will be refunded in full.',
          ],
        },
        {
          heading: 'Payments',
          paras: [
            'Payments are made online through Razorpay using the methods shown at checkout (such as UPI, cards and net banking). Your payment details are handled by Razorpay and are not stored by us.',
          ],
        },
        {
          heading: 'Shipping, returns and refunds',
          paras: [
            'Delivery is governed by our Shipping Policy, and returns and refunds are governed by our Returns & Refunds Policy. Both are part of these terms.',
          ],
        },
        {
          heading: 'Your account',
          paras: [
            'You are responsible for keeping your login details confidential and for all activity under your account. Please give us accurate information when you register and when you order.',
          ],
        },
        {
          heading: 'Acceptable use',
          paras: [
            'You agree not to misuse the website, attempt unauthorised access, interfere with its operation, or use it for any unlawful purpose.',
          ],
        },
        {
          heading: 'Intellectual property',
          paras: [
            `All text, images, logos and designs on this website belong to ${brand} or are used with permission. You may not copy or reuse them without our written consent.`,
          ],
        },
        {
          heading: 'Limitation of liability',
          paras: [
            'To the extent permitted by law, our liability for any claim related to an order is limited to the amount you paid for that order. We are not responsible for delays caused by events beyond our control, such as courier delays, natural events or strikes.',
          ],
        },
        {
          heading: 'Governing law',
          paras: [
            'These terms are governed by the laws of India. Any dispute will be subject to the jurisdiction of the courts at Jaipur, Rajasthan.',
          ],
        },
        {
          heading: 'Changes to these terms',
          paras: [
            'We may update these terms from time to time. Continuing to use the website after a change means you accept the updated terms.',
          ],
        },
        { heading: 'Contact us', list: contactBlock },
      ],
    },

    shipping: {
      title: 'Shipping Policy',
      intro: `This policy explains how ${legalName} ships your orders.`,
      sections: [
        {
          heading: 'Where we deliver',
          paras: [
            'We deliver to serviceable pin codes across India. If your pin code is not serviceable, we will contact you to cancel the order and refund your payment in full.',
          ],
        },
        {
          heading: 'Shipping charges',
          list: [
            `Orders of Rs. ${threshold.toLocaleString('en-IN')} or more: free shipping.`,
            `Orders below Rs. ${threshold.toLocaleString('en-IN')}: a flat shipping fee of Rs. ${shippingFee.toLocaleString('en-IN')}.`,
            'The exact shipping amount is shown at checkout before you pay.',
          ],
        },
        {
          heading: 'Processing and delivery time',
          list: [
            `Orders are packed and dispatched within ${POLICY_CONFIG.dispatchTime} after payment is confirmed.`,
            `Delivery usually takes ${POLICY_CONFIG.deliveryTime} after dispatch, depending on your location.`,
            'These are estimates. Delays can happen during sale periods, bad weather or courier disruptions.',
          ],
        },
        {
          heading: 'Order tracking',
          paras: [
            'You can see the status of your order any time under "My Orders" after logging in. For any help, contact us with your order number.',
          ],
        },
        {
          heading: 'Delivery address',
          paras: [
            'Please enter a complete and correct address and a working mobile number. We are not responsible for failed deliveries caused by wrong or incomplete details. Re-delivery may involve extra charges.',
          ],
        },
        {
          heading: 'Damaged or wrong items on delivery',
          paras: [
            `If your parcel arrives damaged or you receive a wrong item, please contact us within ${POLICY_CONFIG.damageReportWindow} of delivery with your order number and clear photos. We will arrange a replacement or refund as per our Returns & Refunds Policy.`,
          ],
        },
        { heading: 'Contact us', list: contactBlock },
      ],
    },

    returns: {
      title: 'Returns & Refunds Policy',
      intro: `We want you to be happy with your purchase from ${legalName}. This policy explains how returns, cancellations and refunds work.`,
      sections: [
        {
          heading: 'Return window',
          paras: [
            returnsEnabled
              ? `You can request a return within ${returnDays} days of delivery.`
              : 'Returns are currently not being accepted, except for items that arrive damaged, defective or incorrect.',
          ],
        },
        {
          heading: 'Eligible items',
          list: [
            'The item is unused, unwashed and in its original packaging.',
            'The item arrived damaged or defective, or is different from what you ordered.',
            'Items that have been used, washed, altered or damaged after delivery cannot be returned.',
          ],
        },
        {
          heading: 'How to request a return',
          list: [
            `Contact us at ${email} or ${phone} within the return window.`,
            'Share your order number and clear photos of the item (and the packaging, if it arrived damaged).',
            'Once we approve your request, we will tell you how to send the item back or arrange a pickup.',
          ],
        },
        {
          heading: 'Cancellation before dispatch',
          paras: [
            `You can cancel an order before it is dispatched by contacting us at ${email} or ${phone} with your order number. Cancelled paid orders are refunded in full.`,
          ],
        },
        {
          heading: 'Refunds',
          list: [
            'Refunds are made to the original payment method through Razorpay.',
            `After we approve a return or cancellation, the refund is usually completed within ${POLICY_CONFIG.refundTime}. Your bank may take extra time to show it in your account.`,
            'Shipping charges are not refunded, except when the item was damaged, defective or wrong.',
          ],
        },
        {
          heading: 'Payment deducted but order not placed',
          paras: [
            `If money was deducted but your order was not confirmed, the amount is refunded to your original payment method, usually within ${POLICY_CONFIG.refundTime}. If you do not receive it, contact us with your payment reference.`,
          ],
        },
        { heading: 'Contact us', list: contactBlock },
      ],
    },
  };

  const page = pages[type] || pages.privacy;

  useEffect(() => {
    const previous = document.title;
    document.title = `${page.title} | ${brand}`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [page.title]);

  return (
    <div style={{ padding: '56px 0 72px' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          {page.title}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
          Last updated: {POLICY_CONFIG.lastUpdated}
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '32px' }}>
          {page.intro}
        </p>

        {page.sections.map((section) => (
          <section
            key={section.heading}
            style={{ marginBottom: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '10px',
              }}
            >
              {section.heading}
            </h2>
            {(section.paras || []).map((text) => (
              <p key={text} style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '10px' }}>
                {text}
              </p>
            ))}
            {section.list && (
              <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '22px' }}>
                {section.list.map((item) => (
                  <li key={item} style={{ marginBottom: '6px' }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav
          aria-label="Policies"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 22px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{ color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 500 }}
            >
              {link.label}
            </Link>
          ))}
          <Link to="/contact" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 500 }}>
            Contact Us
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default PolicyPage;
