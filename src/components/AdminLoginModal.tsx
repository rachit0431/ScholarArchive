import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { AdminUser } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (admin: AdminUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFillDemoAdmin = () => {
    setEmail('admin@college.edu');
    setPassword('admin123');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.adminLogin(email, password);
      onSuccess(res.admin);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authorization rejected.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-md rounded-xl shadow-2xl p-6 sm:p-8 relative animate-in fade-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E8F5E9] text-[#0F5132] mb-3 border border-[#A7F3D0]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-[10px] tracking-widest uppercase text-[#0F5132] font-semibold block mb-1">
            Controller of Examinations
          </span>
          <h3 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
            Academic Administrator Portal
          </h3>
          <p className="text-xs text-[#5C6F68] mt-1">
            Restricted access for paper curators, curriculum deans, and academic controllers.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1C2826] mb-1">
              Administrator Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="admin@college.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C2826] mb-1">
              Security Passphrase
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[#5C6F68] text-[11px]">System role: Controller of Examinations</span>
            <button
              type="button"
              onClick={handleFillDemoAdmin}
              className="text-[11px] text-[#0F5132] font-semibold hover:underline"
            >
              Fill Demo Credentials
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Verifying Credentials...' : 'Authenticate & Open Admin Panel'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-6 p-3 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-[11px] text-[#5C6F68] leading-relaxed">
          <span className="font-semibold text-[#1C2826] block mb-0.5">Faculty Instructions:</span>
          Admins can upload authentic PDF question papers, edit curricular taxonomies, maintain academic batches, and manage the student-facing catalog in real time.
        </div>
      </div>
    </div>
  );
};
