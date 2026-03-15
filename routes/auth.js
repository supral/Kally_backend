const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createActivityLog } = require('../utils/activityLog');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-fallback-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_PASSWORD = 128;
const MAX_VENDOR_NAME = 200;
const MAX_PROFILE_PHOTO = 2048;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, vendorName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    const nameStr = String(name).trim();
    const emailStr = String(email).toLowerCase().trim();
    const passwordStr = String(password);
    if (nameStr.length === 0) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (nameStr.length > MAX_NAME) return res.status(400).json({ success: false, message: `Name must be at most ${MAX_NAME} characters.` });
    if (emailStr.length === 0) return res.status(400).json({ success: false, message: 'Email is required.' });
    if (emailStr.length > MAX_EMAIL) return res.status(400).json({ success: false, message: `Email must be at most ${MAX_EMAIL} characters.` });
    if (!EMAIL_REGEX.test(emailStr)) return res.status(400).json({ success: false, message: 'Invalid email format.' });
    if (passwordStr.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    if (passwordStr.length > MAX_PASSWORD) return res.status(400).json({ success: false, message: `Password must be at most ${MAX_PASSWORD} characters.` });
    if (vendorName != null && String(vendorName).trim().length > MAX_VENDOR_NAME) return res.status(400).json({ success: false, message: `Vendor name must be at most ${MAX_VENDOR_NAME} characters.` });
    const existingUser = await User.findOne({ email: emailStr });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    // Registration only creates vendors; admin accounts must be created via seeder or admin panel
    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: String(password),
      role: 'vendor',
      vendorName: vendorName ? String(vendorName).trim() : undefined,
      approvalStatus: 'pending',
    });
    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorName: user.vendorName,
        approvalStatus: user.approvalStatus,
        branchId: user.branchId?._id || user.branchId || null,
        branchName: user.branchId?.name || null,
        profilePhoto: user.profilePhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const emailStr = String(email).toLowerCase().trim();
    const passwordStr = String(password);
    if (emailStr.length === 0 || emailStr.length > MAX_EMAIL) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }
    if (passwordStr.length > MAX_PASSWORD) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }
    const user = await User.findOne({ email: emailStr }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!(await user.comparePassword(passwordStr))) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Your account has been blocked. Contact admin.' });
    }
    const u = await User.findById(user._id).populate('branchId', 'name').select('-password').lean();
    const branchId = u.branchId?._id || u.branchId || null;
    const branchName = u.branchId?.name || null;
    const userPayload = {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      vendorName: u.vendorName,
      approvalStatus: u.approvalStatus || (u.role === 'admin' ? 'approved' : 'pending'),
      branchId,
      branchName,
      profilePhoto: u.profilePhoto || null,
    };
    if (user.role === 'vendor' && user.approvalStatus !== 'approved') {
      const token = signToken(user._id);
      return res.json({ success: true, token, user: userPayload });
    }
    const token = signToken(user._id);
    createActivityLog({
      userId: user._id,
      branchId: u.branchId?._id || u.branchId,
      description: 'Logged in',
      details: { role: u.role },
    }).catch(() => {});
    res.json({ success: true, token, user: userPayload });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Login failed.' });
  }
});

router.get('/me', protect, async (req, res) => {
  const u = await User.findById(req.user._id).select('-password').populate('branchId', 'name').lean();
  if (!u) return res.status(401).json({ success: false, message: 'User not found.' });
  const approvalStatus = u.role === 'admin' ? 'approved' : (u.approvalStatus || 'pending');
  const branchId = u.branchId?._id || u.branchId || null;
  const branchName = u.branchId?.name || null;
  res.json({
    success: true,
    user: {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      vendorName: u.vendorName,
      approvalStatus,
      branchId,
      branchName,
      profilePhoto: u.profilePhoto || null,
    },
  });
});

// Update own profile (name, email, vendorName, profilePhoto)
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, email, vendorName, profilePhoto } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length === 0) return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      if (n.length > MAX_NAME) return res.status(400).json({ success: false, message: `Name must be at most ${MAX_NAME} characters.` });
      user.name = n;
    }
    if (email !== undefined) {
      const e = String(email).toLowerCase().trim();
      if (e.length > MAX_EMAIL) return res.status(400).json({ success: false, message: `Email must be at most ${MAX_EMAIL} characters.` });
      if (e && !EMAIL_REGEX.test(e)) return res.status(400).json({ success: false, message: 'Invalid email format.' });
      if (e && e !== user.email) {
        const existing = await User.findOne({ email: e });
        if (existing) return res.status(400).json({ success: false, message: 'Email already in use.' });
        user.email = e;
      }
    }
    if (req.user.role === 'vendor' && vendorName !== undefined) {
      const v = String(vendorName).trim().slice(0, MAX_VENDOR_NAME);
      user.vendorName = v;
    }
    if (profilePhoto !== undefined) {
      const p = profilePhoto == null ? null : String(profilePhoto).trim();
      if (p && p.length > MAX_PROFILE_PHOTO) return res.status(400).json({ success: false, message: 'Profile photo URL too long.' });
      user.profilePhoto = p || null;
    }
    await user.save();
    const u = await User.findById(user._id).populate('branchId', 'name').select('-password').lean();
    const branchId = u.branchId?._id || u.branchId || null;
    const branchName = u.branchId?.name || null;
    createActivityLog({
      userId: req.user._id,
      branchId: u.branchId?._id || u.branchId,
      description: 'Updated profile',
      entity: 'user',
      entityId: user._id,
      details: { name: u.name, role: u.role },
    }).catch(() => {});
    res.json({
      success: true,
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        vendorName: u.vendorName,
        approvalStatus: u.approvalStatus || 'pending',
        branchId,
        branchName,
        profilePhoto: u.profilePhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update profile.' });
  }
});

router.patch('/me', protect, async (req, res) => {
  try {
    const { branchId } = req.body;
    if (req.user.role !== 'vendor') {
      return res.status(400).json({ success: false, message: 'Only vendors can set their own branch.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.branchId = branchId || null;
    await user.save();
    const u = await User.findById(user._id).populate('branchId', 'name').select('-password').lean();
    const newBranchId = u.branchId?._id || u.branchId || null;
    const newBranchName = u.branchId?.name || null;
    createActivityLog({
      userId: req.user._id,
      branchId: newBranchId,
      description: 'Updated assigned branch',
      entity: 'user',
      entityId: user._id,
      details: { branchName: newBranchName },
    }).catch(() => {});
    res.json({
      success: true,
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        vendorName: u.vendorName,
        approvalStatus: u.approvalStatus || 'pending',
        branchId: newBranchId,
        branchName: newBranchName,
        profilePhoto: u.profilePhoto || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update profile.' });
  }
});

// Change own password
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = newStr;
    await user.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update password.' });
  }
});

module.exports = router;
