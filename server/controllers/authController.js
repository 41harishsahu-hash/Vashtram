const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');

// Helper to send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = user.getSignedJwtToken();
  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    address: user.address || {},
  };

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userData,
  });
};

// @desc    Register a new customer
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Password security policy check (min 8 chars, letters & numbers, no common passwords)
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      return res.status(400).json({
        success: false,
        message: policy.message,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Always create as customer from public endpoint. Password is saved untrimmed as entered.
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone ? phone.trim() : '',
      role: 'customer',
    });

    sendTokenResponse(user, 201, res, 'Registration successful! Welcome to VASHTRAM.');
  } catch (error) {
    next(error);
  }
};

// @desc    Login user / admin
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password as valid strings',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    // Passwords must NOT be trimmed or altered anywhere
    const rawPassword = password;

    // Find user with password
    let user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      console.warn('[Auth Login Failed]: Invalid credentials provided');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password strictly using raw unaltered password
    const isMatch = await user.matchPassword(rawPassword);

    if (!isMatch) {
      console.warn('[Auth Login Failed]: Invalid credentials provided');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.',
      });
    }

    console.log(`[Auth Login Success]: User authenticated successfully (${user.role})`);
    sendTokenResponse(user, 200, res, `Welcome back, ${user.name}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Login (strict role check: role must be 'admin')
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password as valid strings',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawPassword = password;

    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      console.warn('[Admin Login Failed]: Invalid credentials provided');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password strictly using raw unaltered password
    const isMatch = await user.matchPassword(rawPassword);

    if (!isMatch) {
      console.warn('[Admin Login Failed]: Invalid credentials provided');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.',
      });
    }

    if (user.role !== 'admin') {
      console.warn('[Admin Login Rejected]: Non-admin account attempted admin portal login');
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have administrator permissions.',
      });
    }

    console.log('[Admin Login Success]: Admin user authenticated');
    sendTokenResponse(user, 200, res, `Welcome back Admin, ${user.name}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        address: user.address || {},
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile & address
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Name validation
    if (req.body.name !== undefined) {
      const trimmedName = req.body.name.trim();
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters' });
      }
      if (trimmedName.length > 60) {
        return res.status(400).json({ success: false, message: 'Full name cannot exceed 60 characters' });
      }
      user.name = trimmedName;
    }

    // Phone validation
    if (req.body.phone !== undefined) {
      const cleanPhone = req.body.phone.trim().replace(/\D/g, '');
      if (cleanPhone) {
        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid 10-digit Indian mobile number starting with 6-9',
          });
        }
        user.phone = cleanPhone;
      } else {
        user.phone = '';
      }
    }

    // Address validation
    if (req.body.address) {
      const addr = req.body.address;
      const cleanAddress = {};

      if (addr.fullName !== undefined) {
        const fn = (addr.fullName || '').trim();
        if (fn && fn.length > 60) {
          return res.status(400).json({ success: false, message: 'Recipient name cannot exceed 60 characters' });
        }
        cleanAddress.fullName = fn;
      }

      if (addr.mobileNumber !== undefined) {
        const mob = (addr.mobileNumber || '').trim().replace(/\D/g, '');
        if (mob) {
          if (!/^[6-9]\d{9}$/.test(mob)) {
            return res.status(400).json({
              success: false,
              message: 'Recipient mobile must be a valid 10-digit mobile number starting with 6-9',
            });
          }
          cleanAddress.mobileNumber = mob;
        } else {
          cleanAddress.mobileNumber = '';
        }
      }

      if (addr.address !== undefined) {
        const a = (addr.address || '').trim();
        if (a && a.length > 250) {
          return res.status(400).json({ success: false, message: 'Address cannot exceed 250 characters' });
        }
        cleanAddress.address = a;
      }

      if (addr.city !== undefined) {
        const c = (addr.city || '').trim();
        if (c && c.length > 60) {
          return res.status(400).json({ success: false, message: 'City cannot exceed 60 characters' });
        }
        cleanAddress.city = c;
      }

      if (addr.state !== undefined) {
        cleanAddress.state = (addr.state || '').trim();
      }

      if (addr.pincode !== undefined) {
        const pin = (addr.pincode || '').trim().replace(/\D/g, '');
        if (pin) {
          if (!/^\d{6}$/.test(pin)) {
            return res.status(400).json({
              success: false,
              message: 'Pincode must be exactly 6 digits',
            });
          }
          cleanAddress.pincode = pin;
        } else {
          cleanAddress.pincode = '';
        }
      }

      user.address = {
        ...user.address,
        ...cleanAddress,
      };
    }

    // If password change is requested
    if (req.body.newPassword) {
      if (!req.body.currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change password',
        });
      }

      // Validate new password against policy (min 8 chars, mix of letters/numbers, no common passwords)
      const policy = validatePasswordPolicy(req.body.newPassword);
      if (!policy.valid) {
        return res.status(400).json({
          success: false,
          message: policy.message,
        });
      }

      const userWithPass = await User.findById(req.user.id).select('+password');
      const isMatch = await userWithPass.matchPassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password does not match',
        });
      }
      user.password = req.body.newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    // Only issue a fresh token when the password changed (tokenVersion was bumped),
    // so existing sessions are not unnecessarily invalidated on every profile edit.
    const passwordChanged = !!req.body.newPassword;
    const newToken = passwordChanged ? user.getSignedJwtToken() : undefined;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      // Only include token in response when it was rotated (password change)
      ...(newToken ? { token: newToken } : {}),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        address: user.address || {},
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout (revokes token server-side if provided, plus client cleanup)
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id);
          if (user) {
            user.tokenVersion = (user.tokenVersion || 0) + 1;
            await user.save();
          }
        }
      } catch {
        // Token already invalid/expired; continue
      }
    }
  } catch {}

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

module.exports = {
  register,
  login,
  adminLogin,
  getMe,
  updateProfile,
  logout,
};
