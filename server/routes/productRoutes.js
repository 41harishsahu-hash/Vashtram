const express = require('express');
const router = express.Router();
const {
  getProducts,
  getFeaturedProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  validateCart,
} = require('../controllers/productController');
const { protect, optionalAuth, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(optionalAuth, getProducts)
  .post(protect, admin, createProduct);

router.get('/featured', getFeaturedProducts);

router.post('/validate-cart', validateCart);

router.route('/:identifier')
  .get(optionalAuth, getProduct);

router.route('/:id')
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

module.exports = router;
