import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../services/api';
import { resolveImageUrl } from '../utils/imageUrl';

const DEFAULT_ABOUT = {
  imageUrl: '/img/About/About.jpeg',
  altText: 'VASHTRAM Textile Weaving and Heritage',
  heading: 'Crafting What Gives You Comfort,Every good day begins with a good night’s sleep.',
  subheading:
    'Your bed is more than a piece of furniture. It is where you rest after a long day, spend time with your family, recharge, and begin each new morning. We believe something this important deserves thoughtful luxury.',
};

const AboutPage = () => {
  const [aboutData, setAboutData] = useState(DEFAULT_ABOUT);

  useEffect(() => {
    let isMounted = true;
    api
      .get('/about')
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.about) {
          setAboutData((prev) => ({
            ...prev,
            ...res.data.about,
          }));
        }
      })
      .catch((err) => {
        console.warn('[AboutPage]: Could not fetch dynamic about data:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 'clamp(24px, 4vw, 40px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
          <span
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: 'var(--accent-color)',
              display: 'block',
              marginBottom: '10px',
            }}
          >
            The VASHTRAM Story <br />
            Since 2020
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              marginBottom: '16px',
            }}
          >
            {aboutData.heading || DEFAULT_ABOUT.heading}
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
              color: 'var(--text-secondary)',
              maxWidth: '680px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {aboutData.subheading || DEFAULT_ABOUT.subheading}
          </p>
        </div>

        {/* Feature Visual */}
        <div
          style={{
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            marginBottom: 'clamp(28px, 4vw, 48px)',
            backgroundColor: 'var(--bg-secondary)',
            minHeight: '200px',
          }}
        >
          <img
            src={resolveImageUrl(aboutData.imageUrl, DEFAULT_ABOUT.imageUrl)}
            alt={aboutData.altText || DEFAULT_ABOUT.altText}
            onError={(e) => {
              if (!e.currentTarget.dataset.triedFallback) {
                e.currentTarget.dataset.triedFallback = 'true';
                e.currentTarget.src = DEFAULT_ABOUT.imageUrl;
              }
            }}
            style={{ width: '100%', height: 'clamp(200px, 45vw, 380px)', objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Narrative */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            padding: 'clamp(20px, 4vw, 40px)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
            marginBottom: 'clamp(28px, 4vw, 48px)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.6rem',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            That belief is what inspired VASHTRAM.
          </h2>
          <p style={{ marginBottom: '20px' }}>
            VASHTRAM was created with a simple purpose — to make luxury bedding and home textiles comfortable, practical, reliable, and accessible for everyday homes.          </p>
          <p style={{ marginBottom: '20px' }}>
            We understand that modern households need products that do more than simply look good. They need products that can keep up with everyday life — from accidental spills and moisture to dust, stains, and regular wear.
          </p>
          <p style={{ marginBottom: '20px' }}>
            That is why we focus on creating mattress protectors and home textiles designed around protection, comfort, quality, and everyday convenience.
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.6rem',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            The VASHTRAM Journey
          </h2>
          <p style={{ marginBottom: '20px' }}>
            We wanted to create a better balance between protection and the sleeping experience.
          </p>
          <p style={{ marginBottom: '20px' }}>
            From selecting suitable materials to focusing on practical designs, every part of our approach is guided by the needs of real homes. We believe bedding should quietly do its job while allowing you to enjoy a comfortable night's sleep.
          </p>
          <p style={{ marginBottom: '20px' }}>
            Over time, this vision became VASHTRAM — a brand dedicated to helping families care for one of the most important parts of their bedroom.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '24px',
              marginTop: '32px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '24px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                100%
              </h3>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Waterproof Mattress Protectors
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Soft & Comfortable</p>
            </div>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                220 - 250
              </h3>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                GSM Fabric
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tested &amp; certified weaves</p>
            </div>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                7 Days
              </h3>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Doorstep Return Policy
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>100% risk-free comfort trial</p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/shop" className="btn btn-primary btn-lg">
            Experience VASHTRAM Bed Linens <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
