/**
 * FILE: src/pages/auth/CustomerRegister.jsx
 *
 * Business/customer registration form.
 *   - Single-page form with all fields.
 *   - Calls registerCustomer() from AuthContext on submit.
 *   - Frontend regex validation for email and password.
 *   - Inline error messages for every field.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const REGEX = {
  email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
  password: /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]{8,}$/,
};

export default function CustomerRegister() {
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    company_name: '', business_type: '', gst_number: '',
    contact_person: '', phone_number: '', email: '',
    shipping_address: '', password: '', confirmPassword: '',
    agreed: false,
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => ({ ...p, [field]: '' }));
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.company_name.trim()) e.company_name = 'Company name is required.';
    if (!form.business_type) e.business_type = 'Select a business type.';
    if (!form.contact_person.trim()) e.contact_person = 'Contact person is required.';
    if (!form.email) e.email = 'Email is required.';
    else if (!REGEX.email.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Password is required.';
    else if (!REGEX.password.test(form.password))
      e.password = 'Min 8 chars, at least one number and one special character.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!form.agreed) e.agreed = 'You must agree to the terms.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      await registerCustomer({
        email: form.email.toLowerCase(),
        profile_name: form.contact_person.trim(),
        password: form.password,
        company_name: form.company_name.trim(),
        business_type: form.business_type,
        gst_number: form.gst_number || undefined,
        contact_person: form.contact_person.trim(),
        phone_number: form.phone_number || undefined,
        shipping_address: form.shipping_address || undefined,
      });
      navigate('/customer');
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.response?.data?.errors?.join(' '))
        || 'Registration failed. Please try again.';
      setApiError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 mesh-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-lg">🌾</div>
            <span className="font-display font-bold text-2xl text-surface-900">BioPaddy</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-surface-900 mt-2">Business Registration</h1>
          <p className="text-surface-500 mt-1">Join as a business partner and go eco-friendly</p>
        </div>

        <div className="card p-8">
          {apiError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Company Name */}
              <div className="col-span-2">
                <label className="input-label">Company Name</label>
                <input type="text" value={form.company_name} onChange={set('company_name')}
                  placeholder="Your company name"
                  className={`input-field ${errors.company_name ? 'border-red-400' : ''}`} />
                {errors.company_name && <p className="mt-1 text-xs text-red-500">{errors.company_name}</p>}
              </div>

              {/* Business Type */}
              <div>
                <label className="input-label">Business Type</label>
                <select value={form.business_type} onChange={set('business_type')}
                  className={`input-field ${errors.business_type ? 'border-red-400' : ''}`}>
                  <option value="">Select type</option>
                  <option value="qsr">Quick Service Restaurant</option>
                  <option value="hotel">Hotel & Resorts</option>
                  <option value="caterer">Caterer & Events</option>
                  <option value="corporate">Corporate</option>
                  <option value="other">Other</option>
                </select>
                {errors.business_type && <p className="mt-1 text-xs text-red-500">{errors.business_type}</p>}
              </div>

              {/* GST */}
              <div>
                <label className="input-label">GST Number (optional)</label>
                <input type="text" value={form.gst_number} onChange={set('gst_number')}
                  placeholder="e.g. 07AABCG1234L1ZG" className="input-field" />
              </div>

              {/* Contact Person */}
              <div>
                <label className="input-label">Contact Person</label>
                <input type="text" value={form.contact_person} onChange={set('contact_person')}
                  placeholder="Full name" className={`input-field ${errors.contact_person ? 'border-red-400' : ''}`} />
                {errors.contact_person && <p className="mt-1 text-xs text-red-500">{errors.contact_person}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="input-label">Phone Number (optional)</label>
                <input type="tel" value={form.phone_number} onChange={set('phone_number')}
                  placeholder="+91 98000 00001" className="input-field" />
              </div>

              {/* Email */}
              <div className="col-span-2">
                <label className="input-label">Email Address</label>
                <input type="email" value={form.email} onChange={set('email')}
                  placeholder="you@company.com"
                  className={`input-field ${errors.email ? 'border-red-400' : ''}`} />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Address */}
              <div className="col-span-2">
                <label className="input-label">Office Address</label>
                <textarea rows={2} value={form.shipping_address} onChange={set('shipping_address')}
                  placeholder="Complete office address" className="input-field" />
              </div>

              {/* Password */}
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="Min 8 chars, number & symbol"
                    className={`input-field pr-10 ${errors.password ? 'border-red-400' : ''}`} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="input-label">Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
                  placeholder="Repeat password"
                  className={`input-field ${errors.confirmPassword ? 'border-red-400' : ''}`} />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2 pt-2">
              <input type="checkbox" id="agreed" checked={form.agreed}
                onChange={set('agreed')} className="mt-1 rounded border-surface-300" />
              <label htmlFor="agreed" className="text-sm text-surface-500 cursor-pointer">
                I agree to BioPaddy's{' '}
                <a href="#" className="text-brand-600 underline">Terms of Service</a> and{' '}
                <a href="#" className="text-brand-600 underline">Privacy Policy</a>
              </label>
            </div>
            {errors.agreed && <p className="text-xs text-red-500">{errors.agreed}</p>}

            <button type="submit" disabled={submitLoading}
              className="btn-primary w-full py-3.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitLoading ? 'Creating Account…' : 'Create Business Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-semibold">Login</Link>
        </p>
      </motion.div>
    </div>
  );
}
