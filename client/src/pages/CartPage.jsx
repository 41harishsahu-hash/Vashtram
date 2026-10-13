import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/useCart';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';

const CartPage = () => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    shipping,
    total,
    freeShippingThreshold = 999,
    validateCartWithServer,
  } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (validateCartWithServer) {
      validateCartWithServer();
    }
  }, [validateCartWithServer]);

  if (cart.length === 0) {
    return (
      <div className="container" style={{ padding: '90px 0', textAlign: 'center' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'var(--accent-color)',
          }}
        >
          <ShoppingBag size={36} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '12px' }}>
          Your Cart is Empty
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 28px' }}>
          Looks like you haven't added any mattress protectors yet. Discover our waterproof and breathable collection.
        </p>
        <Link to="/shop" className="btn btn-primary btn-lg">
          Explore Mattress Protector Collection <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingPercent = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  return (
    <div style={{ padding: 'clamp(20px, 3.5vw, 36px) 0 clamp(40px, 6vw, 80px)' }}>
      <div className="container">
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'clamp(18px, 3vw, 32px)',
          }}
        >
          Shopping Bag ({cart.length} {cart.length === 1 ? 'item' : 'items'})
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: 'clamp(20px, 3.5vw, 36px)',
            alignItems: 'start',
          }}
          className="cart-grid"
        >
          {/* Items List */}
          <div>
            {/* Free shipping progress bar */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                padding: 'clamp(12px, 2.5vw, 16px) clamp(14px, 3vw, 20px)',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {remainingForFreeShipping === 0
                    ? '🎉 You have unlocked FREE Express Delivery!'
                    : `Add ₹${remainingForFreeShipping.toLocaleString('en-IN')} more for Free Shipping`}
                </span>
                <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{freeShippingPercent}%</span>
              </div>
              <div
                style={{
                  height: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${freeShippingPercent}%`,
                    backgroundColor: 'var(--accent-color)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* Cart Items */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}
            >
              {cart.map((item, index) => (
                <div
                  key={`${item.product}-${item.size}-${item.color || ''}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'clamp(14px, 2.5vw, 20px)',
                    borderBottom:
                      index < cart.length - 1 ? '1px solid var(--border-color)' : 'none',
                    gap: 'clamp(12px, 2vw, 20px)',
                    flexWrap: 'wrap',
                  }}
                  className="cart-item"
                >
                  {/* Thumbnail and Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2vw, 16px)', minWidth: 0, flex: 1 }}>
                    <Link
                      to={`/product/${item.slug || item.product}`}
                      style={{
                        width: 'clamp(60px, 15vw, 80px)',
                        height: 'clamp(60px, 15vw, 80px)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-secondary)',
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Link>
                    <div>
                      <Link
                        to={`/product/${item.slug || item.product}`}
                        style={{
                          fontSize: '0.98rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        {item.name}
                      </Link>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Size: <strong>{item.size}</strong> {item.color ? `• ${item.color}` : ''}
                      </p>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        ₹{item.price.toLocaleString('en-IN')} each
                      </p>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <button
                      onClick={() => updateQuantity(item.product, item.quantity - 1, item.size, item.color)}
                      style={{ padding: '6px 10px', color: 'var(--text-primary)' }}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span
                      style={{
                        padding: '0 10px',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        minWidth: '28px',
                        textAlign: 'center',
                      }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product, item.quantity + 1, item.size, item.color)}
                      style={{ padding: '6px 10px', color: 'var(--text-primary)' }}
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div style={{ textAlign: 'right', minWidth: '90px' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.product, item.size, item.color)}
                    style={{
                      color: 'var(--text-muted)',
                      padding: '8px',
                    }}
                    title="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions below items */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '18px',
              }}
            >
              <Link to="/shop" className="btn btn-secondary btn-sm">
                ← Continue Shopping
              </Link>
              <button
                onClick={clearCart}
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                }}
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <aside
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: 'clamp(16px, 3vw, 24px)',
              position: 'sticky',
              top: '90px',
            }}
          >
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
              }}
            >
              Order Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Items Subtotal</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{subtotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Shipping Delivery</span>
                <span style={{ fontWeight: 600, color: shipping === 0 ? '#137333' : 'var(--text-primary)' }}>
                  {shipping === 0 ? 'FREE' : `₹${shipping}`}
                </span>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Total Amount
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{total.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="btn btn-primary btn-lg btn-full"
              style={{ marginBottom: '16px' }}
            >
              Proceed to Checkout <ArrowRight size={18} />
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--accent-color)' }} />
              <span>100% Secure Prepaid Checkout via Razorpay</span>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .cart-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 520px) {
          .cart-item {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .cart-item > div:first-child {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CartPage;
