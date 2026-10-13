const Settings = require('../models/Settings');

// @desc    Get store settings (public)
// @route   GET /api/settings or GET /api/settings/admin
// @access  Public / Admin
const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.getSingleton();
    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update store settings (admin)
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res, next) => {
  try {
    const settings = await Settings.getSingleton();

    const {
      storeName,
      supportEmail,
      supportPhone,
      storeAddress,
      whatsappNumber,
      currency,
      freeShippingThreshold,
      standardShippingFee,
      enableReturns,
      returnDays,
    } = req.body;

    if (storeName !== undefined) {
      const cleanName = String(storeName).trim();
      if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Store name must be between 2 and 100 characters',
        });
      }
      settings.storeName = cleanName;
    }

    if (supportEmail !== undefined) {
      const cleanEmail = String(supportEmail).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid support email address',
        });
      }
      settings.supportEmail = cleanEmail;
    }

    if (supportPhone !== undefined) {
      const cleanPhone = String(supportPhone).trim();
      if (cleanPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid support phone number',
        });
      }
      settings.supportPhone = cleanPhone;
    }

    if (storeAddress !== undefined) {
      const cleanAddress = String(storeAddress).trim();
      if (!cleanAddress || cleanAddress.length < 5 || cleanAddress.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Store address must be between 5 and 500 characters',
        });
      }
      settings.storeAddress = cleanAddress;
    }

    if (whatsappNumber !== undefined) {
      const cleanWa = String(whatsappNumber).trim();
      if (!cleanWa) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp business number cannot be empty',
        });
      }
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(cleanWa)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid WhatsApp phone number (minimum 7 digits)',
        });
      }
      settings.whatsappNumber = cleanWa;
    }

    if (currency !== undefined) {
      const cleanCur = String(currency).trim();
      if (!cleanCur || cleanCur.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid currency label',
        });
      }
      settings.currency = cleanCur;
    }

    if (freeShippingThreshold !== undefined) {
      const numThreshold = Number(freeShippingThreshold);
      if (isNaN(numThreshold) || numThreshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Free shipping threshold must be a non-negative number (0 or greater)',
        });
      }
      if (numThreshold > 1000000) {
        return res.status(400).json({
          success: false,
          message: 'Free shipping threshold cannot exceed ₹10,00,000',
        });
      }
      settings.freeShippingThreshold = numThreshold;
    }

    if (standardShippingFee !== undefined) {
      const numFee = Number(standardShippingFee);
      if (isNaN(numFee) || numFee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Standard shipping fee must be a non-negative number (0 or greater)',
        });
      }
      if (numFee > 50000) {
        return res.status(400).json({
          success: false,
          message: 'Standard shipping fee cannot exceed ₹50,000',
        });
      }
      settings.standardShippingFee = numFee;
    }

    if (enableReturns !== undefined) {
      settings.enableReturns = Boolean(enableReturns);
    }

    if (returnDays !== undefined) {
      const numDays = Number(returnDays);
      if (isNaN(numDays) || !Number.isInteger(numDays) || numDays < 0) {
        return res.status(400).json({
          success: false,
          message: 'Return days must be a non-negative whole number (0 or greater)',
        });
      }
      if (numDays > 365) {
        return res.status(400).json({
          success: false,
          message: 'Return days cannot exceed 365 days',
        });
      }
      settings.returnDays = numDays;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Store settings saved successfully',
      settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
