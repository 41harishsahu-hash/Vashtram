import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatSizeLabel } from '../utils/sizeHelper';
import { useSettings } from './useSettings';
import { CartContext } from './cartContextDef';
import { storage } from '../utils/storage';
import api from '../services/api';

/**
 * Resolves the authoritative unit price for a given product and size selection:
 * 1. Variant price from size (if finite number)
 * 2. Product discountPrice (if finite, > 0, and < product.price)
 * 3. Product base price (if finite, >= 0)
 * Returns finite number or null if unresolvable.
 */
export const resolveUnitPrice = (product, size) => {
  if (!product) return null;

  // 1. Direct size object with price property
  if (size && typeof size === 'object' && Number.isFinite(Number(size.price))) {
    return Number(size.price);
  }

  // 2. Size string matching a variant in product.sizes
  if (typeof size === 'string' && product.sizes && product.sizes.length > 0) {
    const sTrim = size.trim().toLowerCase();
    const matched = product.sizes.find(
      (s) =>
        (s.name && s.name.trim().toLowerCase() === sTrim) ||
        (s.measurement && s.measurement.trim().toLowerCase() === sTrim) ||
        (`${s.measurement} (${s.name})`.toLowerCase() === sTrim) ||
        (`${s.name} (${s.measurement})`.toLowerCase() === sTrim)
    );
    if (matched && Number.isFinite(Number(matched.price))) {
      return Number(matched.price);
    }
  }

  // 3. Valid discountPrice
  const discount = Number(product.discountPrice);
  const regular = Number(product.price);
  if (
    product.discountPrice !== null &&
    product.discountPrice !== undefined &&
    Number.isFinite(discount) &&
    discount > 0 &&
    Number.isFinite(regular) &&
    discount < regular
  ) {
    return discount;
  }

  // 4. Base price
  if (Number.isFinite(regular) && regular >= 0) {
    return regular;
  }

  return null;
};

// Helper to normalize color strings: empty and undefined color are equal
const normalizeColor = (c) => (c ? String(c).trim().toLowerCase() : '');
const normalizeSize = (s) => (s ? String(s).trim() : '');

export const isSameCartLine = (item, productId, size, color) => {
  const itemProdId = item.product?._id || item.product || item.productId;
  const targetProdId = productId?._id || productId;
  return (
    String(itemProdId) === String(targetProdId) &&
    normalizeSize(item.size) === normalizeSize(size) &&
    normalizeColor(item.color) === normalizeColor(color)
  );
};

// Sanitize the cart when loading from localStorage:
// drop lines with non-finite price or quantity < 1; treat missing color as ""
const sanitizeCart = (rawCart) => {
  if (!Array.isArray(rawCart)) return [];
  return rawCart
    .filter((item) => {
      if (!item || !item.product) return false;
      const price = Number(item.price);
      const qty = Number(item.quantity);
      return Number.isFinite(price) && price >= 0 && Number.isInteger(qty) && qty >= 1;
    })
    .map((item) => ({
      ...item,
      color: item.color ? String(item.color).trim() : '',
      size: item.size ? String(item.size).trim() : '',
      quantity: Number(item.quantity),
      price: Number(item.price),
    }));
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const saved = storage.getCart();
      return sanitizeCart(saved);
    } catch {
      return [];
    }
  });

  const [notification, setNotification] = useState(null);
  const toastTimerRef = useRef(null);

  // Synchronize cart with storage whenever cart state changes
  useEffect(() => {
    storage.setCart(cart);
  }, [cart]);

  // Show temporary toast notification with timer cleanup
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setNotification({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setNotification(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setNotification(null);
  }, []);

  // Pure add-to-cart: compute outcome outside state setter, set state, then toast
  const addToCart = (product, quantity = 1, size = null, color = null) => {
    if (!product) return;

    const resolvedPrice = resolveUnitPrice(product, size);
    if (resolvedPrice === null || !Number.isFinite(resolvedPrice)) {
      showToast('Unable to determine price for selected product or size', 'error');
      return;
    }

    let chosenSizeLabel = 'Standard';
    let chosenMeasurement = '';
    let chosenSizeName = '';

    if (size && typeof size === 'object') {
      chosenMeasurement = size.measurement || '';
      chosenSizeName = size.name || '';
      chosenSizeLabel = formatSizeLabel(size);
    } else if (typeof size === 'string' && size.trim()) {
      chosenSizeLabel = size.trim();
    } else if (product.sizes && product.sizes.length > 0) {
      const first = product.sizes[0];
      chosenMeasurement = first.measurement || '';
      chosenSizeName = first.name || '';
      chosenSizeLabel = formatSizeLabel(first);
    } else if (product.size) {
      chosenSizeLabel = product.size;
    }

    const chosenColor = color ? String(color).trim() : (product.color ? String(product.color).trim() : '');

    const existingIndex = cart.findIndex((item) =>
      isSameCartLine(item, product._id, chosenSizeLabel, chosenColor)
    );

    if (existingIndex > -1) {
      const currentItem = cart[existingIndex];
      const newQty = currentItem.quantity + quantity;
      if (newQty > product.stock) {
        showToast(`Cannot add more. Only ${product.stock} left in stock.`, 'warning');
        return;
      }
      const updated = cart.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: newQty } : item
      );
      setCart(updated);
      showToast(`Updated "${product.name} (${chosenSizeLabel})" quantity to ${newQty}`);
    } else {
      if (quantity > product.stock) {
        showToast(`Cannot add. Only ${product.stock} available.`, 'warning');
        return;
      }
      const newItem = {
        product: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images && product.images.length > 0 ? product.images[0] : '',
        price: resolvedPrice,
        originalPrice: product.price,
        discountPrice: product.discountPrice,
        stock: product.stock,
        size: chosenSizeLabel,
        sizeMeasurement: chosenMeasurement,
        sizeName: chosenSizeName,
        color: chosenColor,
        quantity,
      };
      setCart([...cart, newItem]);
      showToast(`Added "${product.name} (${chosenSizeLabel})" to your cart`);
    }
  };

  // Pure update quantity: identified by product + size + color
  const updateQuantity = (productId, newQuantity, size = null, color = null) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }

    const existingItem = cart.find((item) => isSameCartLine(item, productId, size, color));
    if (existingItem && newQuantity > existingItem.stock) {
      showToast(`Only ${existingItem.stock} items currently in stock.`, 'warning');
      return;
    }

    const updated = cart.map((item) => {
      if (isSameCartLine(item, productId, size, color)) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    });

    setCart(updated);
  };

  // Pure remove from cart: identified by product + size + color
  const removeFromCart = (productId, size = null, color = null) => {
    const updated = cart.filter((item) => !isSameCartLine(item, productId, size, color));
    setCart(updated);
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  // Synchronize cart with live catalog from server (POST /api/products/validate-cart)
  const validateCartWithServer = useCallback(async () => {
    if (!cart || cart.length === 0) return;
    try {
      const payload = cart.map((item) => ({
        product: item.product,
        size: item.size,
        color: item.color || '',
      }));

      const res = await api.post('/products/validate-cart', payload);
      if (res.data?.success && Array.isArray(res.data.items)) {
        const validatedMap = new Map();
        res.data.items.forEach((v) => {
          const key = `${v.product}:::${normalizeSize(v.size)}:::${normalizeColor(v.color)}`;
          validatedMap.set(key, v);
        });

        const changes = [];
        const nextCart = [];

        cart.forEach((item) => {
          const key = `${item.product}:::${normalizeSize(item.size)}:::${normalizeColor(item.color)}`;
          const live = validatedMap.get(key);

          if (!live || !live.exists || !live.isActive || live.stock <= 0) {
            changes.push(`"${item.name}" is no longer available (removed from cart)`);
            return;
          }

          let updatedItem = { ...item };

          // Check live effective price
          const liveEffectivePrice =
            live.discountPrice > 0 && live.discountPrice < live.price
              ? live.discountPrice
              : live.price;

          if (liveEffectivePrice !== item.price) {
            changes.push(`price changed for "${item.name}": now ₹${liveEffectivePrice}`);
            updatedItem.price = liveEffectivePrice;
            updatedItem.originalPrice = live.price;
            updatedItem.discountPrice = live.discountPrice;
          }

          // Check stock limit
          if (item.quantity > live.stock) {
            changes.push(`only ${live.stock} left for "${item.name}" (quantity adjusted)`);
            updatedItem.quantity = live.stock;
          }

          updatedItem.stock = live.stock;
          nextCart.push(updatedItem);
        });

        if (changes.length > 0) {
          setCart(nextCart);
          showToast(changes.join('. '), 'warning');
        }
      }
    } catch (err) {
      console.warn('validateCartWithServer failed:', err);
    }
  }, [cart, showToast]);

  // Calculations
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const subtotal = cart.reduce((acc, item) => {
    const effectivePrice = item.price;
    return acc + effectivePrice * item.quantity;
  }, 0);

  const { settings } = useSettings();
  const freeShippingThreshold =
    settings?.freeShippingThreshold !== undefined && settings?.freeShippingThreshold !== null
      ? Number(settings.freeShippingThreshold)
      : 999;
  const standardShippingFee =
    settings?.standardShippingFee !== undefined && settings?.standardShippingFee !== null
      ? Number(settings.standardShippingFee)
      : 99;

  // Free shipping on orders >= freeShippingThreshold (sourced dynamically from DB settings)
  const shipping =
    cart.length === 0 ? 0 : subtotal >= freeShippingThreshold ? 0 : standardShippingFee;
  const total = subtotal + shipping;

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        subtotal,
        shipping,
        freeShippingThreshold,
        standardShippingFee,
        total,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        resolveUnitPrice,
        validateCartWithServer,
        notification,
        showToast,
        hideToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
