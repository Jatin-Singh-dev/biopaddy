/**
 * FILE: server/src/routes/auth.routes.js
 *
 * Auth routes for BioPaddy platform.
 * - Registration (farmer + customer): email + password only.
 * - Login: email + password for all roles.
 * - Token refresh and session restore via /me.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Farmer, Customer } from '../models/index.js';
import { getSignedUrl } from '../config/supabase.js';

const router = Router();

// ─── Regex constants ──────────────────────────────────────────────────────────
const REGEX = {
  // RFC-5321 practical email validation
  email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
  // Min 8 chars, at least 1 digit, at least 1 special character
  password: /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]{8,}$/,
  // Indian bank account: 9–18 digits
  bankAccount: /^[0-9]{9,18}$/,
  // IFSC: 4 letters + 0 + 6 alphanumeric
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
};

// ─── Helper: generate JWT pair ───────────────────────────────────────────────
function generateTokens(user) {
  const payload = {
    user_id: user.user_id,
    user_type: user.user_type,
    profile_name: user.profile_name,
    email: user.email,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '24h',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
  return { token, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register/farmer
// Body: { email, profile_name, password, aadhaar_number, land_area_acres,
//         primary_crop, language_preference, farm_location_lat,
//         farm_location_long, bank_account_number, bank_ifsc }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/farmer', async (req, res, next) => {
  try {
    const {
      email, profile_name, password,
      aadhaar_number, land_area_acres, primary_crop,
      language_preference, farm_location_lat, farm_location_long,
      bank_account_number, bank_ifsc,
    } = req.body;

    // ── 1. Presence checks ──────────────────────────────────────────────────
    if (!email || !profile_name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, full name, and password are required.',
      });
    }

    // ── 2. Regex validation ─────────────────────────────────────────────────
    const errors = [];
    if (!REGEX.email.test(email)) errors.push('Invalid email format.');
    if (!REGEX.password.test(password))
      errors.push('Password must be at least 8 characters and include at least one number and one special character.');
    if (bank_account_number && !REGEX.bankAccount.test(bank_account_number))
      errors.push('Bank account number must be 9–18 digits.');
    if (bank_ifsc && !REGEX.ifsc.test(bank_ifsc.toUpperCase()))
      errors.push('IFSC code must be in the format: ABCD0123456 (4 letters + 0 + 6 alphanumeric).');

    if (errors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed.', errors });
    }

    // ── 3. Duplicate check ──────────────────────────────────────────────────
    const exists = await User.findOne({ where: { email: email.toLowerCase() } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    // ── 4. Create user + farmer profile ────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      profile_name: profile_name.trim(),
      password_hash,
      user_type: 'farmer',
      is_verified: true,
    });

    const farmer = await Farmer.create({
      user_id: user.user_id,
      aadhaar_number,
      land_area_acres,
      primary_crop,
      language_preference,
      farm_location_lat,
      farm_location_long,
      bank_account_number,
      bank_ifsc: bank_ifsc?.toUpperCase(),
    });

    const tokens = generateTokens(user);
    res.status(201).json({
      success: true,
      message: 'Farmer registered successfully.',
      data: {
        user: {
          user_id: user.user_id,
          profile_name: user.profile_name,
          email: user.email,
          user_type: user.user_type,
        },
        farmer_id: farmer.farmer_id,
        ...tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register/customer
// Body: { email, profile_name, password, company_name, business_type,
//         gst_number?, contact_person, phone_number?, shipping_address }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register/customer', async (req, res, next) => {
  try {
    const {
      email, profile_name, password,
      company_name, business_type, gst_number,
      contact_person, phone_number, shipping_address,
    } = req.body;

    // ── 1. Presence checks ──────────────────────────────────────────────────
    if (!email || !profile_name || !password || !company_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, password, and company name are required.',
      });
    }

    // ── 2. Regex validation ─────────────────────────────────────────────────
    const errors = [];
    if (!REGEX.email.test(email)) errors.push('Invalid email format.');
    if (!REGEX.password.test(password))
      errors.push('Password must be at least 8 characters and include at least one number and one special character.');

    if (errors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed.', errors });
    }

    // ── 3. Duplicate check ──────────────────────────────────────────────────
    const exists = await User.findOne({ where: { email: email.toLowerCase() } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    // ── 4. Create user + customer profile ──────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      phone_number,
      profile_name: profile_name.trim(),
      password_hash,
      user_type: 'customer',
      is_verified: true,
    });

    const customer = await Customer.create({
      user_id: user.user_id,
      company_name: company_name.trim(),
      business_type,
      gst_number,
      contact_person,
      shipping_address,
    });

    const tokens = generateTokens(user);
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      data: {
        user: {
          user_id: user.user_id,
          profile_name: user.profile_name,
          email: user.email,
          user_type: user.user_type,
        },
        customer_id: customer.customer_id,
        ...tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }  — works for farmer, customer, and admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (!REGEX.email.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.' });
    }

    // Load role-specific profile
    let profile = null;
    if (user.user_type === 'farmer') {
      const p = await Farmer.findOne({ where: { user_id: user.user_id } });
      if (p) {
        profile = p.toJSON();
        profile.aadhaar_front_signed_url = await getSignedUrl(profile.aadhaar_front_url);
        profile.aadhaar_back_signed_url = await getSignedUrl(profile.aadhaar_back_url);
        profile.land_doc_signed_url = await getSignedUrl(profile.land_doc_url);
      }
    } else if (user.user_type === 'customer') {
      profile = await Customer.findOne({ where: { user_id: user.user_id } });
    }

    const tokens = generateTokens(user);
    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          profile_name: user.profile_name,
          email: user.email,
          user_type: user.user_type,
          is_verified: user.is_verified,
        },
        profile,
        ...tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// Body: { refreshToken }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required.' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens({
      user_id: decoded.user_id,
      user_type: decoded.user_type,
      profile_name: decoded.profile_name,
      email: decoded.email,
    });
    res.json({ success: true, data: tokens });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me  — return current user from JWT (used by AuthContext on load)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.user_id, {
      attributes: ['user_id', 'profile_name', 'email', 'user_type', 'is_verified', 'is_active'],
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    }

    let profile = null;
    if (user.user_type === 'farmer') {
      const p = await Farmer.findOne({ where: { user_id: user.user_id } });
      if (p) {
        profile = p.toJSON();
        profile.aadhaar_front_signed_url = await getSignedUrl(profile.aadhaar_front_url);
        profile.aadhaar_back_signed_url = await getSignedUrl(profile.aadhaar_back_url);
        profile.land_doc_signed_url = await getSignedUrl(profile.land_doc_url);
      }
    } else if (user.user_type === 'customer') {
      profile = await Customer.findOne({ where: { user_id: user.user_id } });
    }

    res.json({ success: true, data: { user, profile } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

export default router;
