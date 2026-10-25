const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Hero = require('../models/Hero');

const categoriesData = [
  {
    name: 'King Size Mattress Protectors',
    slug: 'king-size',
    description: 'Expansive waterproof protection for standard and super king size mattresses. Keeps your mattress fresh and hygienic.',
    image: '/img/Category/Category1.jpeg',
    order: 1,
    isActive: true,
  },
  {
    name: 'Queen Size Mattress Protectors',
    slug: 'queen-size',
    description: 'Perfect snug-fit protection for your modern queen mattress. Waterproof, breathable, and easy to wash.',
    image: '/img/Category/Category2.jpeg',
    order: 2,
    isActive: true,
  },
  {
    name: 'Single Bed Mattress Protectors',
    slug: 'single-bed',
    description: 'Tailored protection for kids, guest rooms, and single beds. Comfortable, durable, and stain-resistant.',
    image: '/img/Category/Category3.jpeg',
    order: 3,
    isActive: true,
  },
  {
    name: 'Waterproof Collection',
    slug: 'cotton',
    description: 'Our premium waterproof range. Breathable top layer with a quiet, rustling-free waterproof membrane.',
    image: '/img/Category/Category4.jpeg',
    order: 4,
    isActive: true,
  },
  {
    name: 'Quilted Collection',
    slug: 'printed',
    description: 'Thick quilted mattress protectors offering cushioning comfort and full waterproof protection.',
    image: '/img/Category/Category1.1.jpeg',
    order: 5,
    isActive: true,
  },
  {
    name: 'Premium Luxury Collection',
    slug: 'premium-collection',
    description: 'Hotel-grade mattress protectors with ultra-soft cotton terry top and silent waterproof barrier.',
    image: '/img/Category/Category2.1.jpeg',
    order: 6,
    isActive: true,
  },
];

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? null : 'mongodb://127.0.0.1:27017/vashtram');
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required for seeding in production.');
    }
    await mongoose.connect(mongoUri);
    console.log('[Seeder]: Connected to MongoDB...');

    // Clear existing collections
    await Order.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();
    await User.deleteMany();
    await Hero.deleteMany();

    console.log('[Seeder]: Previous database collections cleared.');

    // 1. Create Admin & Demo Customers
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required for seeding.');
    }

    await User.create({
      name: 'VASHTRAM Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: '9876543210',
      address: {
        fullName: 'VASHTRAM Admin HQ',
        mobileNumber: '9876543210',
        address: 'VASHTRAM Mattress Protectors, D-482 Jagdamba Nagar',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302021',
      },
    });

    const demoPassword = process.env.DEMO_USER_PASSWORD || adminPassword;

    const customer1 = await User.create({
      name: 'Rohan Sharma',
      email: 'customer@example.com',
      password: demoPassword,
      role: 'customer',
      phone: '9876543210',
      address: {
        fullName: 'Rohan Sharma',
        mobileNumber: '9876543210',
        address: 'Flat 402, Lotus Towers, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400053',
      },
    });

    const customer2 = await User.create({
      name: 'Priya Verma',
      email: 'priya.verma@example.com',
      password: demoPassword,
      role: 'customer',
      phone: '9812345678',
      address: {
        fullName: 'Priya Verma',
        mobileNumber: '9812345678',
        address: '12B, Green Park Extension',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110016',
      },
    });

    const customer3 = await User.create({
      name: 'Amit Singh',
      email: 'amit.singh@example.com',
      password: demoPassword,
      role: 'customer',
      phone: '9923456789',
      address: {
        fullName: 'Amit Singh',
        mobileNumber: '9923456789',
        address: '88, Koramangala 4th Block',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
      },
    });

    console.log('[Seeder]: Admin and Demo Users created.');

    // 2. Create Categories
    const createdCategories = await Category.insertMany(categoriesData);
    console.log(`[Seeder]: ${createdCategories.length} Categories seeded.`);

    const catMap = {};
    createdCategories.forEach((c) => {
      catMap[c.slug] = c._id;
    });

    // 3. Create 16 Realistic Mattress Protector Products
    const productsData = [
      {
        name: 'Waterproof Cotton Terry Mattress Protector',
        slug: 'waterproof-cotton-terry-mattress-protector',
        description: 'Our best-selling waterproof mattress protector. Features a luxuriously soft cotton terry top surface with a silent, rustling-free waterproof membrane beneath. Guards against spills, sweat, dust mites, and allergens while remaining breathable for comfortable sleep.',
        price: 2499,
        discountPrice: 1499,
        category: catMap['cotton'],
        material: '100% Cotton Terry + TPU Membrane',
        size: 'King',
        color: 'White',
        colorHex: '#FDFBF7',
        pattern: 'Solid',
        images: [
          '/img/product1.jpeg',
          '/img/product2.jpeg',
          '/img/product3.jpeg',
        ],
        stock: 24,
        sku: 'VST-WCT-101',
        rating: 4.8,
        numReviews: 120,
        careInstructions: 'Machine wash cold on gentle cycle with mild detergent. Tumble dry low or line dry in shade. Do not iron the waterproof surface.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Quilted Waterproof Mattress Protector',
        slug: 'quilted-waterproof-mattress-protector',
        description: 'Thick quilted mattress protector offering extra cushioning comfort along with full waterproof protection. The quilted top layer adds plush softness while the waterproof base keeps your mattress dry and clean at all times.',
        price: 2199,
        discountPrice: 1299,
        category: catMap['queen-size'],
        material: 'Quilted Microfibre + Waterproof Base',
        size: 'Queen',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Quilted',
        images: [
          '/img/product4.jpeg',
          '/img/Blue1.jpeg',
        ],
        stock: 18,
        sku: 'VST-QWP-102',
        rating: 4.7,
        numReviews: 86,
        careInstructions: 'Gentle machine wash with like colors. Do not bleach. Air dry for best results.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Premium King Size Mattress Protector',
        slug: 'premium-king-size-mattress-protector',
        description: 'Designed for king size mattresses, this premium protector combines a breathable cotton surface with a silent waterproof barrier. Deep fitted skirt with elastic all-around ensures a secure, no-slip fit on mattresses up to 12 inches deep.',
        price: 2799,
        discountPrice: 1699,
        category: catMap['king-size'],
        material: 'Cotton Blend + Silent Waterproof Membrane',
        size: 'King',
        color: 'Ivory',
        colorHex: '#F5F0E8',
        pattern: 'Solid',
        images: [
          '/img/blue2.jpeg',
          '/img/blue3.jpeg',
        ],
        stock: 15,
        sku: 'VST-PKS-103',
        rating: 4.9,
        numReviews: 67,
        careInstructions: 'Machine wash warm, gentle spin. Cool tumble dry.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Organic Cotton Mattress Protector',
        slug: 'organic-cotton-mattress-protector',
        description: 'Crafted from unbleached organic cotton, this mattress protector is skin-friendly, hypoallergenic, and certified free from harmful chemicals. Ideal for sensitive sleepers, infants, and allergy sufferers.',
        price: 2299,
        discountPrice: 1399,
        category: catMap['cotton'],
        material: '100% Organic Percale Cotton + Waterproof Layer',
        size: 'King',
        color: 'Natural Beige',
        colorHex: '#D8C3A5',
        pattern: 'Solid',
        images: [
          '/img/brown1.jpeg',
          '/img/brown2.jpeg',
        ],
        stock: 30,
        sku: 'VST-OC-104',
        rating: 4.6,
        numReviews: 104,
        careInstructions: 'Machine wash cold. Do not dry clean.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Quilted Fitted Queen Mattress Protector',
        slug: 'quilted-fitted-queen-mattress-protector',
        description: 'Extra-thick quilted queen mattress protector with a fitted skirt that wraps snugly around the mattress. Provides superior cushioning and waterproof protection. Machine washable for easy care.',
        price: 2499,
        discountPrice: 1599,
        category: catMap['printed'],
        material: 'Quilted Polyester + Waterproof TPU',
        size: 'Queen',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Quilted',
        images: [
          '/img/brown3.jpeg',
          '/img/gray1.jpeg',
        ],
        stock: 12,
        sku: 'VST-QFQ-105',
        rating: 4.7,
        numReviews: 42,
        careInstructions: 'Machine wash cold with gentle spin. Line dry.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Hotel Grade Luxury Mattress Protector',
        slug: 'hotel-grade-luxury-mattress-protector',
        description: 'The same quality used in premium hotels. Ultra-soft cotton terry top with a whisper-quiet waterproof barrier. Provides all-night comfort while protecting your investment mattress from stains, moisture, and dust mites.',
        price: 2999,
        discountPrice: 1799,
        category: catMap['premium-collection'],
        material: 'Cotton Terry + Waterproof Barrier',
        size: 'King',
        color: 'White',
        colorHex: '#FDFBF7',
        pattern: 'Solid',
        images: [
          '/img/gray2.jpeg',
          '/img/gray3.jpeg',
        ],
        stock: 8,
        sku: 'VST-HGL-106',
        rating: 4.9,
        numReviews: 53,
        careInstructions: 'Gentle cycle wash. Low tumble dry.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Hypoallergenic Mattress Protector',
        slug: 'hypoallergenic-mattress-protector',
        description: 'Specially designed for allergy and asthma sufferers. Creates a protective barrier against dust mites, pet dander, mould, and allergens. Soft, breathable, and fully waterproof.',
        price: 3199,
        discountPrice: 1899,
        category: catMap['premium-collection'],
        material: 'Hypoallergenic Microfibre + Waterproof Membrane',
        size: 'King',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Solid',
        images: [
          '/img/red1.jpeg',
          '/img/red2.jpeg',
        ],
        stock: 14,
        sku: 'VST-HAP-107',
        rating: 4.9,
        numReviews: 78,
        careInstructions: 'Machine wash warm, avoid bleach, low tumble dry.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Bamboo Waterproof Mattress Protector',
        slug: 'bamboo-waterproof-mattress-protector',
        description: 'Eco-friendly bamboo fibre top layer with a waterproof backing. Bamboo is naturally antibacterial, odour-resistant, and temperature-regulating, making this protector ideal for warm climates and sensitive skin.',
        price: 2399,
        discountPrice: 1449,
        category: catMap['printed'],
        material: 'Bamboo Fibre Blend + Waterproof Base',
        size: 'King',
        color: 'Natural White',
        colorHex: '#F0EDE6',
        pattern: 'Solid',
        images: [
          '/img/red3.jpeg',
          '/img/red4.jpeg',
        ],
        stock: 22,
        sku: 'VST-BWP-108',
        rating: 4.7,
        numReviews: 39,
        careInstructions: 'Wash separately on gentle cycle. Medium tumble dry.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Breathable Cotton Queen Mattress Protector',
        slug: 'breathable-cotton-queen-mattress-protector',
        description: 'Made from a cotton and polyester blend for superior breathability. Keeps the sleep surface cool and dry throughout the night. Fully waterproof with a fitted skirt that accommodates mattresses up to 10 inches.',
        price: 2699,
        discountPrice: 1649,
        category: catMap['cotton'],
        material: 'Cotton-Polyester Blend + Waterproof Layer',
        size: 'Queen',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Solid',
        images: [
          '/img/product1.jpeg',
          '/img/product2.jpeg',
        ],
        stock: 16,
        sku: 'VST-BCQ-109',
        rating: 4.8,
        numReviews: 46,
        careInstructions: 'Gentle wash cycle. Tumble dry low.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Deep Pocket King Mattress Protector',
        slug: 'deep-pocket-king-mattress-protector',
        description: 'Designed for deep and pillow-top mattresses. The extra-deep fitted skirt accommodates mattresses up to 18 inches. Soft cotton top with a fully waterproof base for complete mattress protection.',
        price: 2199,
        discountPrice: 1349,
        category: catMap['printed'],
        material: '100% Cotton Top + Deep Pocket Waterproof',
        size: 'King',
        color: 'White',
        colorHex: '#FDFBF7',
        pattern: 'Solid',
        images: [
          '/img/product3.jpeg',
          '/img/product4.jpeg',
        ],
        stock: 19,
        sku: 'VST-DPK-110',
        rating: 4.6,
        numReviews: 31,
        careInstructions: 'Machine wash cold. Line dry.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Anti-Dust Mite King Size Protector',
        slug: 'anti-dust-mite-king-size-protector',
        description: 'Laboratory-tested barrier against dust mites, their allergens, and pet dander. The tightly woven microfibre cover acts as a physical barrier while remaining completely breathable and comfortable.',
        price: 2499,
        discountPrice: 1549,
        category: catMap['king-size'],
        material: 'Tightly Woven Microfibre + Waterproof Base',
        size: 'King',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Solid',
        images: [
          '/img/Blue1.jpeg',
          '/img/blue2.jpeg',
        ],
        stock: 11,
        sku: 'VST-ADM-111',
        rating: 4.7,
        numReviews: 28,
        careInstructions: 'Machine wash cold. Tumble dry low.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Premium Fitted Mattress Encasement',
        slug: 'premium-fitted-mattress-encasement',
        description: 'Full 6-sided mattress encasement offering 360° protection. Ideal for allergy sufferers, this encasement seals the entire mattress, providing a complete barrier against bed bugs, dust mites, moisture, and stains.',
        price: 3599,
        discountPrice: 2199,
        category: catMap['premium-collection'],
        material: 'Microfibre Encasement + Waterproof Zip Closure',
        size: 'King',
        color: 'White',
        colorHex: '#FDFBF7',
        pattern: 'Solid',
        images: [
          '/img/blue3.jpeg',
          '/img/brown1.jpeg',
        ],
        stock: 6,
        sku: 'VST-PFE-112',
        rating: 5.0,
        numReviews: 64,
        careInstructions: 'Dry clean recommended or gentle cycle with mild detergent.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Single Bed Waterproof Protector',
        slug: 'single-bed-waterproof-protector',
        description: 'Compact and fully waterproof protection for single and cot-size mattresses. Perfect for kids beds, hostel rooms, and guest accommodation. Lightweight, breathable, and easy to machine wash.',
        price: 1499,
        discountPrice: 899,
        category: catMap['single-bed'],
        material: '100% Cotton Terry + Waterproof Membrane',
        size: 'Single',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Solid',
        images: [
          '/img/brown2.jpeg',
          '/img/brown3.jpeg',
        ],
        stock: 25,
        sku: 'VST-SBW-113',
        rating: 4.5,
        numReviews: 19,
        careInstructions: 'Daily machine wash safe. Fast-drying fabric.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Kids Waterproof Single Mattress Protector',
        slug: 'kids-waterproof-single-mattress-protector',
        description: 'Designed with children in mind. Extra waterproof protection with a soft, non-crinkly cotton surface that children will not even notice. Ideal for potty training, night-time accidents, and school dorms.',
        price: 1599,
        discountPrice: 949,
        category: catMap['single-bed'],
        material: 'Soft Cotton + Heavy-Duty Waterproof Layer',
        size: 'Single',
        color: 'White',
        colorHex: '#FFFFFF',
        pattern: 'Solid',
        images: [
          '/img/gray1.jpeg',
          '/img/gray2.jpeg',
        ],
        stock: 18,
        sku: 'VST-KWS-114',
        rating: 4.6,
        numReviews: 24,
        careInstructions: 'Machine wash cold.',
        isFeatured: false,
        isActive: true,
      },
      {
        name: 'Cooling Gel-Infused Mattress Protector',
        slug: 'cooling-gel-infused-mattress-protector',
        description: 'Advanced cooling technology for hot sleepers. Gel-infused microfibre top layer actively draws heat away from the body, keeping the sleep surface cool. Fully waterproof and machine washable.',
        price: 3299,
        discountPrice: 1999,
        category: catMap['printed'],
        material: 'Gel-Infused Microfibre + Waterproof Base',
        size: 'King',
        color: 'White',
        colorHex: '#F0F4F8',
        pattern: 'Solid',
        images: [
          '/img/gray3.jpeg',
          '/img/red1.jpeg',
        ],
        stock: 4, // Low stock product for dashboard demonstration!
        sku: 'VST-CGI-115',
        rating: 4.9,
        numReviews: 89,
        careInstructions: 'Handwash cold or gentle machine cycle for first two washes. Mild detergent.',
        isFeatured: true,
        isActive: true,
      },
      {
        name: 'Ultra-Soft Velour Mattress Protector',
        slug: 'ultra-soft-velour-mattress-protector',
        description: 'Premium velour surface for a luxurious sleeping experience. The soft, plush top adds comfort while the waterproof barrier below provides full mattress protection. Perfect for luxury bedrooms and guest suites.',
        price: 3799,
        discountPrice: 2299,
        category: catMap['premium-collection'],
        material: 'Velour Cotton + Silent Waterproof Membrane',
        size: 'King',
        color: 'Ivory',
        colorHex: '#FDFBF7',
        pattern: 'Solid',
        images: [
          '/img/red2.jpeg',
          '/img/red3.jpeg',
        ],
        stock: 3, // Low stock product for dashboard demonstration!
        sku: 'VST-USV-116',
        rating: 4.9,
        numReviews: 57,
        careInstructions: 'Machine wash cold. Tumble dry gentle.',
        isFeatured: false,
        isActive: true,
      },
    ];

    const defaultSizes = [
      { measurement: '48×75', name: 'Double', price: 344 },
      { measurement: '60×75', name: 'Queen', price: 481 },
      { measurement: '60×78', name: 'Queen', price: 471 },
      { measurement: '72×72', name: 'King', price: 501 },
      { measurement: '72×75', name: 'King', price: 501 },
      { measurement: '72×78', name: 'King', price: 449 },
      { measurement: '72×84', name: 'King', price: 549 },
      { measurement: '', name: 'Free Size', price: 525 },
    ];

    const enrichedProducts = productsData.map((p) => ({
      ...p,
      sizes: p.sizes || defaultSizes,
    }));

    const createdProducts = await Product.insertMany(enrichedProducts);
    console.log(`[Seeder]: ${createdProducts.length} Mattress Protector products seeded successfully with multiple size options.`);

    // 4. Create Realistic Sample Orders for Admin Dashboard
    const sampleOrders = [
      {
        orderNumber: 'VST-1001',
        user: customer1._id,
        items: [
          {
            product: createdProducts[2]._id,
            name: createdProducts[2].name,
            image: createdProducts[2].images[0],
            price: createdProducts[2].discountPrice,
            quantity: 1,
            size: 'King',
            color: 'Slate Charcoal',
          },
        ],
        shippingAddress: {
          fullName: 'Rohan Sharma',
          mobileNumber: '9876543210',
          email: 'customer@example.com',
          address: 'Flat 402, Lotus Towers, Andheri West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400053',
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Completed',
        orderStatus: 'Delivered',
        subtotal: 1699,
        shippingPrice: 0,
        totalAmount: 1699,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        statusHistory: [
          { status: 'Pending', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), note: 'Order placed' },
          { status: 'Confirmed', date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), note: 'Order confirmed' },
          { status: 'Shipped', date: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), note: 'Shipped via BlueDart' },
          { status: 'Delivered', date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), note: 'Delivered to customer' },
        ],
      },
      {
        orderNumber: 'VST-1002',
        user: customer2._id,
        items: [
          {
            product: createdProducts[0]._id,
            name: createdProducts[0].name,
            image: createdProducts[0].images[0],
            price: createdProducts[0].discountPrice,
            quantity: 1,
            size: 'King',
            color: 'Ivory Floral',
          },
          {
            product: createdProducts[1]._id,
            name: createdProducts[1].name,
            image: createdProducts[1].images[0],
            price: createdProducts[1].discountPrice,
            quantity: 1,
            size: 'Queen',
            color: 'Soft Blue Stripes',
          },
        ],
        shippingAddress: {
          fullName: 'Priya Verma',
          mobileNumber: '9812345678',
          email: 'priya.verma@example.com',
          address: '12B, Green Park Extension',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110016',
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        orderStatus: 'Shipped',
        subtotal: 2798,
        shippingPrice: 0,
        totalAmount: 2798,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        statusHistory: [
          { status: 'Pending', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), note: 'Order placed' },
          { status: 'Confirmed', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), note: 'Quality check passed' },
          { status: 'Shipped', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), note: 'In transit to Delhi hub' },
        ],
      },
      {
        orderNumber: 'VST-1003',
        user: customer3._id,
        items: [
          {
            product: createdProducts[3]._id,
            name: createdProducts[3].name,
            image: createdProducts[3].images[0],
            price: createdProducts[3].discountPrice,
            quantity: 1,
            size: 'King',
            color: 'Warm Beige',
          },
        ],
        shippingAddress: {
          fullName: 'Amit Singh',
          mobileNumber: '9923456789',
          email: 'amit.singh@example.com',
          address: '88, Koramangala 4th Block',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034',
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        orderStatus: 'Processing',
        subtotal: 1399,
        shippingPrice: 0,
        totalAmount: 1399,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        statusHistory: [
          { status: 'Pending', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), note: 'Order placed' },
          { status: 'Confirmed', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), note: 'Packed at warehouse' },
          { status: 'Processing', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), note: 'Ready for courier pickup' },
        ],
      },
      {
        orderNumber: 'VST-1004',
        user: customer1._id,
        items: [
          {
            product: createdProducts[5]._id,
            name: createdProducts[5].name,
            image: createdProducts[5].images[0],
            price: createdProducts[5].discountPrice,
            quantity: 1,
            size: 'King',
            color: 'Royal Navy Blue',
          },
        ],
        shippingAddress: {
          fullName: 'Rohan Sharma',
          mobileNumber: '9876543210',
          email: 'customer@example.com',
          address: 'Flat 402, Lotus Towers, Andheri West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400053',
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        orderStatus: 'Pending',
        subtotal: 1799,
        shippingPrice: 0,
        totalAmount: 1799,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        statusHistory: [
          { status: 'Pending', date: new Date(Date.now() - 3 * 60 * 60 * 1000), note: 'Order received. Awaiting dispatch confirmation.' },
        ],
      },
    ];

    await Order.insertMany(sampleOrders);
    console.log(`[Seeder]: ${sampleOrders.length} Orders seeded.`);

    // 5. Seed Hero Section Content
    await Hero.create({
      smallLabel: 'Handcrafted Luxury Living',
      heading: 'Bring Comfort & Elegance Home',
      description:
        'Premium mattress protectors designed for everyday protection and comfort. Waterproof, breathable, and crafted to extend the life of your mattress with timeless quality.',
      button1: {
        text: 'Shop Now',
        link: '/shop',
      },
      button2: {
        text: 'Explore Cotton',
        link: '/shop?category=cotton',
      },
      floatingCard: {
        title: 'Signature Heritage Weave',
        subtitle: '100% Combed Cotton • 300+ Thread Count',
        badge: 'In Stock',
        show: true,
      },
      images: [
        {
          url: '/img/HeroCrousel1.jpeg',
          altText: 'VASHTRAM Premium Mattress Protector',
          isActive: true,
          order: 1,
        },
        {
          url: '/img/HeroCrousel2.jpeg',
          altText: 'VASHTRAM Waterproof Mattress Protector Collection',
          isActive: true,
          order: 2,
        },
        {
          url: '/img/HeroCrousel3.jpeg',
          altText: 'VASHTRAM Breathable King Size Mattress Protector',
          isActive: true,
          order: 3,
        },
        {
          url: '/img/HeroCrousel4.jpeg',
          altText: 'VASHTRAM Ultra-Soft Velour Mattress Protector',
          isActive: true,
          order: 4,
        },
      ],
    });
    console.log('[Seeder]: Hero Section content and image slides seeded.');

    console.log('\n=========================================');
    console.log('✓ VASHTRAM DATABASE SEEDED SUCCESSFULLY!');
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Admin Account:    ${adminEmail}`);
      console.log('Customer Account: customer@example.com');
    } else {
      console.log(`Admin Account created with email: ${adminEmail}`);
    }
    console.log('=========================================\n');

    process.exit(0);
  } catch (error) {
    console.error(`[Seeder Error]: ${error.message}`);
    process.exit(1);
  }
};

seedData();
