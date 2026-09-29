import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Github,
  Linkedin,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { SOCIAL_CONFIG } from '../config/socialConfig';
import { api } from '../services/api';
import { StudentUser, AdminUser } from '../types';

interface ContactPageProps {
  currentStudent: StudentUser | null;
  currentAdmin: AdminUser | null;
  onNavigateBack: () => void;
  onOpenLogin?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({
  currentStudent,
  currentAdmin,
  onNavigateBack,
  onOpenLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResponse, setSuccessResponse] = useState<{
    message: string;
    messageId?: string;
    previewUrl?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  }>({});

  // Copy email state
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Auto-fill student details if logged in
  useEffect(() => {
    if (currentStudent) {
      if (!name) setName(currentStudent.name);
      if (!email) setEmail(currentStudent.email);
    } else if (currentAdmin) {
      if (!name) setName(currentAdmin.name);
      if (!email) setEmail(currentAdmin.email);
    }
  }, [currentStudent, currentAdmin]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SOCIAL_CONFIG.recipientEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; email?: string; subject?: string; message?: string } = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (subject.trim().length < 3) {
      errors.subject = 'Subject must be at least 3 characters';
    }

    if (!message.trim()) {
      errors.message = 'Message content is required';
    } else if (message.trim().length < 10) {
      errors.message = 'Message must be at least 10 characters long';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.sendContactMessage({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
      });

      setSuccessResponse({
        message: response.message,
        messageId: response.messageId,
        previewUrl: response.previewUrl,
      });

      // Clear subject and message, retain name and email
      setSubject('');
      setMessage('');
      setFieldErrors({});
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      setErrorMessage(err.message || 'Failed to dispatch your inquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessResponse(null);
    setErrorMessage(null);
    if (!currentStudent && !currentAdmin) {
      setName('');
      setEmail('');
    }
    setSubject('');
    setMessage('');
    setFieldErrors({});
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24">
      {/* Top Banner Header */}
      <section className="bg-[#FAF8F5] border-b border-[#E5DFD5] pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb / Back button */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F5132] hover:text-[#064E3B] transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Question Papers</span>
            </button>

            {/* User status badge */}
            <div className="text-xs text-[#5C6F68]">
              {currentStudent ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-[#0F5132]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Authenticated Student: {currentStudent.name}
                </span>
              ) : currentAdmin ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-[#0F5132]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Administrator: {currentAdmin.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span>Guest / Prospective Inquirer</span>
                  {onOpenLogin && (
                    <button
                      onClick={onOpenLogin}
                      className="text-[#0F5132] hover:underline font-semibold"
                    >
                      Sign In
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="max-w-3xl">
            <span className="text-xs font-mono-code font-semibold tracking-wider text-[#0F5132] uppercase block mb-2">
              Institutional Communications · Student Support Desk
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif-academic font-bold text-[#1C2826] tracking-tight mb-3">
              Connect & Direct Inquiries
            </h1>
            <p className="text-sm text-[#5C6F68] leading-relaxed">
              Have a question regarding previous year question papers, syllabi alignment, or examination archives? Submit your message below. It is delivered directly to{' '}
              <strong className="text-[#1C2826] font-mono-code">{SOCIAL_CONFIG.recipientEmail}</strong> for prompt institutional review.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content: Split 2-Column Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Direct Info & Social Connect (4 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Contact Card */}
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 shadow-xs">
              <h2 className="text-lg font-serif-academic font-bold text-[#1C2826] mb-1">
                Office of the Examination Desk
              </h2>
              <p className="text-xs text-[#5C6F68] mb-6">
                Official institutional communications gateway for undergraduate and postgraduate assessment archives.
              </p>

              <div className="space-y-4 text-xs">
                {/* Direct Email Address with Copy Button */}
                <div className="p-3.5 bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg">
                  <div className="text-[11px] font-medium text-[#5C6F68] uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Direct Recipient Email</span>
                    <span className="text-[#0F5132] font-semibold text-[10px]">Verified Dispatch</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <a
                      href={`mailto:${SOCIAL_CONFIG.recipientEmail}`}
                      className="font-mono-code font-semibold text-xs text-[#0F5132] hover:underline truncate"
                      title={SOCIAL_CONFIG.recipientEmail}
                    >
                      {SOCIAL_CONFIG.recipientEmail}
                    </a>
                    <button
                      onClick={handleCopyEmail}
                      type="button"
                      title="Copy email address"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-[#E5DFD5] text-[#1C2826] hover:bg-[#F5F1EB] transition-colors shrink-0"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          <span className="text-[#10B981]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#5C6F68]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Desk details */}
                <div className="flex items-start gap-3 text-xs text-[#5C6F68]">
                  <Building2 className="w-4 h-4 text-[#0F5132] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#1C2826]">
                      {SOCIAL_CONFIG.institutionalDesk.office}
                    </div>
                    <div>{SOCIAL_CONFIG.institutionalDesk.division}</div>
                    <div>{SOCIAL_CONFIG.institutionalDesk.institution}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs text-[#5C6F68]">
                  <Clock className="w-4 h-4 text-[#0F5132] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#1C2826]">Working Hours & SLA</div>
                    <div>{SOCIAL_CONFIG.institutionalDesk.workingHours}</div>
                    <div className="text-[11px] text-[#0F5132] mt-0.5 font-medium">
                      {SOCIAL_CONFIG.institutionalDesk.responseTime}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Connect Card with Clickable Icons */}
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-serif-academic font-bold text-[#1C2826] mb-1">
                Official Profiles & Social Links
              </h2>
              <p className="text-xs text-[#5C6F68] mb-4">
                Connect via external platforms and professional networks:
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {/* GitHub */}
                <a
                  href={SOCIAL_CONFIG.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] hover:bg-[#F5F1EB] hover:border-[#0F5132]/40 text-[#1C2826] transition-all group shadow-2xs"
                  title="View GitHub Profile"
                >
                  <div className="w-8 h-8 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#1C2826] group-hover:text-[#0F5132] transition-colors shrink-0">
                    <Github className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                      <span>GitHub</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#5C6F68] group-hover:text-[#0F5132] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-[#5C6F68] truncate">Source & Code</div>
                  </div>
                </a>

                {/* LinkedIn */}
                <a
                  href={SOCIAL_CONFIG.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] hover:bg-[#F5F1EB] hover:border-[#0A66C2]/40 text-[#1C2826] transition-all group shadow-2xs"
                  title="Connect on LinkedIn"
                >
                  <div className="w-8 h-8 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#0A66C2] group-hover:bg-[#0A66C2] group-hover:text-white transition-colors shrink-0">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                      <span>LinkedIn</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#5C6F68] group-hover:text-[#0A66C2] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-[#5C6F68] truncate">Professional Network</div>
                  </div>
                </a>

                {/* Instagram */}
                <a
                  href={SOCIAL_CONFIG.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] hover:bg-[#F5F1EB] hover:border-[#E4405F]/40 text-[#1C2826] transition-all group shadow-2xs"
                  title="Follow on Instagram"
                >
                  <div className="w-8 h-8 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#E4405F] group-hover:bg-[#E4405F] group-hover:text-white transition-colors shrink-0">
                    <Instagram className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                      <span>Instagram</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#5C6F68] group-hover:text-[#E4405F] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-[#5C6F68] truncate">Campus & Life</div>
                  </div>
                </a>

                {/* Direct Email */}
                <a
                  href={`mailto:${SOCIAL_CONFIG.recipientEmail}`}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E5DFD5] bg-[#FAF8F5] hover:bg-[#F5F1EB] hover:border-[#0F5132]/40 text-[#1C2826] transition-all group shadow-2xs"
                  title="Send Direct Email"
                >
                  <div className="w-8 h-8 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#0F5132] group-hover:bg-[#0F5132] group-hover:text-white transition-colors shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight flex items-center gap-1">
                      <span>Email</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#5C6F68] group-hover:text-[#0F5132] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[10px] text-[#5C6F68] truncate">Direct Inbox</div>
                  </div>
                </a>
              </div>

              <div className="mt-4 pt-4 border-t border-[#E5DFD5] flex items-center gap-2 text-[11px] text-[#5C6F68]">
                <ShieldCheck className="w-4 h-4 text-[#0F5132]" />
                <span>All channels verified by Institutional Academic Council</span>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#E5DFD5] pb-5 mb-6">
                <h2 className="text-xl font-serif-academic font-bold text-[#1C2826]">
                  Send a Direct Message
                </h2>
                <p className="text-xs text-[#5C6F68] mt-1">
                  Fill in the details below. Messages are routed immediately to the Controller of Examinations inbox.
                </p>
              </div>

              {/* Success Notification Banner */}
              {successResponse && (
                <div className="mb-6 p-5 bg-[#E8F5E9] border border-[#A7F3D0] rounded-lg text-xs space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#0F5132] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-[#0F5132] text-sm">
                        Message Dispatched Successfully
                      </div>
                      <p className="text-[#1C2826] leading-relaxed">
                        {successResponse.message}
                      </p>
                      {successResponse.messageId && (
                        <div className="text-[11px] text-[#5C6F68] font-mono-code pt-1">
                          Delivery Reference: {successResponse.messageId}
                        </div>
                      )}
                      {successResponse.previewUrl && (
                        <div className="pt-2">
                          <a
                            href={successResponse.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#A7F3D0] rounded-md font-semibold text-[#0F5132] hover:bg-[#D1FAE5] transition-colors"
                          >
                            <span>Inspect Real Email Delivery Preview</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#A7F3D0]/60 flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-3 py-1.5 bg-[#0F5132] text-white font-semibold rounded-md hover:bg-[#064E3B] transition-colors shadow-2xs"
                    >
                      Send Another Message
                    </button>
                  </div>
                </div>
              )}

              {/* Error Notification Banner */}
              {errorMessage && (
                <div className="mb-6 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs flex items-start gap-3 text-[#991B1B] animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Delivery Error</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* The Form */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Row 1: Name and Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name field */}
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-semibold text-[#1C2826] mb-1.5"
                    >
                      Your Full Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={e => {
                        setName(e.target.value);
                        if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      placeholder="e.g. Aarav Sharma"
                      className={`w-full px-3.5 py-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1C2826] placeholder-[#8C9E96] transition-colors focus:bg-white focus:outline-none focus:ring-1 ${
                        fieldErrors.name
                          ? 'border-[#DC2626] focus:ring-[#DC2626]'
                          : 'border-[#E5DFD5] focus:border-[#0F5132] focus:ring-[#0F5132]'
                      }`}
                      required
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-[11px] text-[#DC2626] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{fieldErrors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Email field */}
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-semibold text-[#1C2826] mb-1.5"
                    >
                      Email Address <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      placeholder="e.g. student@college.edu"
                      className={`w-full px-3.5 py-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1C2826] placeholder-[#8C9E96] transition-colors focus:bg-white focus:outline-none focus:ring-1 ${
                        fieldErrors.email
                          ? 'border-[#DC2626] focus:ring-[#DC2626]'
                          : 'border-[#E5DFD5] focus:border-[#0F5132] focus:ring-[#0F5132]'
                      }`}
                      required
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-[11px] text-[#DC2626] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{fieldErrors.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Subject field */}
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-semibold text-[#1C2826] mb-1.5"
                  >
                    Subject / Topic <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={subject}
                    onChange={e => {
                      setSubject(e.target.value);
                      if (fieldErrors.subject) setFieldErrors(prev => ({ ...prev, subject: undefined }));
                    }}
                    placeholder="e.g. Inquiry regarding Semester 5 Machine Learning Midterm Paper"
                    className={`w-full px-3.5 py-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1C2826] placeholder-[#8C9E96] transition-colors focus:bg-white focus:outline-none focus:ring-1 ${
                      fieldErrors.subject
                        ? 'border-[#DC2626] focus:ring-[#DC2626]'
                        : 'border-[#E5DFD5] focus:border-[#0F5132] focus:ring-[#0F5132]'
                    }`}
                    required
                  />
                  {fieldErrors.subject && (
                    <p className="mt-1 text-[11px] text-[#DC2626] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{fieldErrors.subject}</span>
                    </p>
                  )}
                </div>

                {/* Message field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-semibold text-[#1C2826]"
                    >
                      Message Content <span className="text-[#DC2626]">*</span>
                    </label>
                    <span className="text-[11px] text-[#5C6F68] font-mono-code">
                      {message.length} characters (min 10)
                    </span>
                  </div>
                  <textarea
                    id="contact-message"
                    rows={6}
                    value={message}
                    onChange={e => {
                      setMessage(e.target.value);
                      if (fieldErrors.message) setFieldErrors(prev => ({ ...prev, message: undefined }));
                    }}
                    placeholder="Please specify your query in detail, including relevant course codes, academic year, or specific examination sessions if applicable..."
                    className={`w-full px-3.5 py-2.5 bg-[#FAF8F5] border rounded-md text-xs text-[#1C2826] placeholder-[#8C9E96] transition-colors focus:bg-white focus:outline-none focus:ring-1 leading-relaxed ${
                      fieldErrors.message
                        ? 'border-[#DC2626] focus:ring-[#DC2626]'
                        : 'border-[#E5DFD5] focus:border-[#0F5132] focus:ring-[#0F5132]'
                    }`}
                    required
                  />
                  {fieldErrors.message && (
                    <p className="mt-1 text-[11px] text-[#DC2626] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{fieldErrors.message}</span>
                    </p>
                  )}
                </div>

                {/* Target email reassurance note */}
                <div className="p-3 bg-[#FAF8F5] border border-[#E5DFD5] rounded-md text-[11px] text-[#5C6F68] flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#0F5132] shrink-0" />
                  <span>
                    Your inquiry will be transmitted directly to{' '}
                    <strong className="text-[#1C2826] font-mono-code">{SOCIAL_CONFIG.recipientEmail}</strong> via server-side verification.
                  </span>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-8 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Dispatching Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
