const Inquiry = require('../models/Inquiry');
const mongoose = require('mongoose');
const { createSafeRegex } = require('../utils/regexHelper');

const DEFAULT_SPAM_KEYWORDS = [
  'casino',
  'crypto giveaway',
  'seo ranking',
  'viagra',
  'whatsapp me',
  'telegram channel',
  'buy followers',
  'free backlink',
];

const getSpamKeywords = () => {
  if (process.env.SPAM_KEYWORDS) {
    return process.env.SPAM_KEYWORDS.split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_SPAM_KEYWORDS;
};

const countLinks = (str) => {
  if (typeof str !== 'string') return 0;
  const matches = str.match(/(?:https?:\/\/|www\.)\S+/gi);
  return matches ? matches.length : 0;
};

const hasSpamKeyword = (text, keywords) => {
  const lower = (text || '').toLowerCase();
  return keywords.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(lower);
  });
};

const stripHtml = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

// @desc    Submit a new contact inquiry (Customer form)
// @route   POST /api/inquiries
// @access  Public
const createInquiry = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message, honeypot, website } = req.body;

    // Honeypot anti-spam check: bots fill hidden fields
    if ((honeypot && String(honeypot).trim() !== '') || (website && String(website).trim() !== '')) {
      return res.status(400).json({ success: false, message: 'Spam submission detected' });
    }

    const trimmedName = stripHtml(name || '');
    const trimmedEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').toString().trim().replace(/\D/g, '');
    const trimmedSubject = stripHtml(subject || '');
    const trimmedMessage = stripHtml(message || '');

    // Anti-spam link detector: allow up to 1 link; reject 2+ links
    const totalLinks = countLinks(trimmedSubject) + countLinks(trimmedMessage);
    if (totalLinks > 1) {
      return res.status(400).json({
        success: false,
        message: 'Multiple promotional links are not permitted in contact inquiries. Please limit to at most 1 reference link.',
      });
    }

    // Anti-spam keywords detector: reject prohibited keywords from configurable list
    const spamKeywords = getSpamKeywords();
    if (
      hasSpamKeyword(trimmedSubject, spamKeywords) ||
      hasSpamKeyword(trimmedMessage, spamKeywords)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry contains prohibited promotional spam keywords.',
      });
    }

    // Name validation
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide a valid name (at least 2 characters)' });
    }
    if (trimmedName.length > 50) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 50 characters' });
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    // Phone validation (optional, but if provided must be a valid 10-digit mobile number)
    if (cleanPhone) {
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit mobile number starting with 6-9',
        });
      }
    }

    // Subject validation
    if (!trimmedSubject || trimmedSubject.length < 3) {
      return res.status(400).json({ success: false, message: 'Inquiry subject must be at least 3 characters' });
    }
    if (trimmedSubject.length > 200) {
      return res.status(400).json({ success: false, message: 'Inquiry subject cannot exceed 200 characters' });
    }

    // Message validation
    if (!trimmedMessage || trimmedMessage.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters so we can assist you better',
      });
    }
    if (trimmedMessage.length > 3000) {
      return res.status(400).json({ success: false, message: 'Message cannot exceed 3000 characters' });
    }

    const inquiry = await Inquiry.create({
      name: trimmedName,
      email: trimmedEmail,
      phone: cleanPhone || '',
      subject: trimmedSubject,
      message: trimmedMessage,
      status: 'New',
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been submitted successfully! Our team will get back to you within 24 hours.',
      inquiry: {
        _id: inquiry._id,
        name: inquiry.name,
        email: inquiry.email,
        subject: inquiry.subject,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all inquiries with filtering & pagination (Admin)
// @route   GET /api/inquiries
// @access  Private/Admin
const getInquiries = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;

    const query = {};

    // Filter by status
    if (status && status !== 'all' && ['New', 'In Progress', 'Resolved', 'Archived'].includes(status)) {
      query.status = status;
    }

    // Search by name, email, phone, or subject
    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchRegex = createSafeRegex(search.trim(), 'i');
      if (searchRegex) {
        query.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { subject: searchRegex },
          { message: searchRegex },
        ];
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [inquiries, total, newCount, inProgressCount, resolvedCount, archivedCount] = await Promise.all([
      Inquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Inquiry.countDocuments(query),
      Inquiry.countDocuments({ status: 'New' }),
      Inquiry.countDocuments({ status: 'In Progress' }),
      Inquiry.countDocuments({ status: 'Resolved' }),
      Inquiry.countDocuments({ status: 'Archived' }),
    ]);

    const allTotal = newCount + inProgressCount + resolvedCount + archivedCount;

    res.status(200).json({
      success: true,
      inquiries,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      stats: {
        total: allTotal,
        new: newCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        archived: archivedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single inquiry by ID (Admin)
// @route   GET /api/inquiries/:id
// @access  Private/Admin
const getInquiryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid inquiry ID' });
    }

    const inquiry = await Inquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.status(200).json({
      success: true,
      inquiry,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inquiry status or admin notes (Admin)
// @route   PUT /api/inquiries/:id
// @access  Private/Admin
const updateInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid inquiry ID' });
    }

    const inquiry = await Inquiry.findById(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    if (status !== undefined) {
      if (!['New', 'In Progress', 'Resolved', 'Archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be one of: New, In Progress, Resolved, Archived',
        });
      }
      inquiry.status = status;
    }

    if (notes !== undefined) {
      inquiry.notes = notes;
    }

    await inquiry.save();

    res.status(200).json({
      success: true,
      message: 'Inquiry updated successfully',
      inquiry,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an inquiry (Admin)
// @route   DELETE /api/inquiries/:id
// @access  Private/Admin
const deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid inquiry ID' });
    }

    const inquiry = await Inquiry.findByIdAndDelete(id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInquiry,
  getInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
};
