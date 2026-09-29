import React from 'react';
import {
  ShieldCheck,
  Archive,
  Award,
  Mail,
  Github,
  Linkedin,
  Instagram,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { SOCIAL_CONFIG } from '../config/socialConfig';

interface FooterProps {
  onNavigateToContact?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToContact }) => {
  return (
    <footer className="bg-[#F5F1EB] border-t border-[#E5DFD5] text-[#5C6F68] mt-20">
      {/* Prominent Connect & Contact Banner */}
      <div className="border-b border-[#E5DFD5] bg-[#EDE8E0]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0F5132]" />
                <span className="text-xs font-mono-code font-semibold tracking-wider text-[#0F5132] uppercase">
                  Direct Institutional Correspondence
                </span>
              </div>
              <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                Have an inquiry about academic question papers or curriculum archives?
              </h3>
              <p className="text-xs text-[#5C6F68] max-w-xl">
                Get in touch directly with the administration desk at{' '}
                <a
                  href={`mailto:${SOCIAL_CONFIG.recipientEmail}`}
                  className="font-mono-code text-[#0F5132] hover:underline font-semibold"
                >
                  {SOCIAL_CONFIG.recipientEmail}
                </a>{' '}
                or connect across official social profiles.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              {/* Clickable Social Icons: GitHub, LinkedIn, Instagram, Email */}
              <div className="flex items-center gap-2">
                {/* GitHub */}
                <a
                  href={SOCIAL_CONFIG.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Profile"
                  title="Connect on GitHub"
                  className="w-9 h-9 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#1C2826] hover:text-[#0F5132] hover:border-[#0F5132] hover:bg-[#FAF8F5] transition-all shadow-2xs"
                >
                  <Github className="w-4 h-4" />
                </a>

                {/* LinkedIn */}
                <a
                  href={SOCIAL_CONFIG.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Profile"
                  title="Connect on LinkedIn"
                  className="w-9 h-9 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-all shadow-2xs"
                >
                  <Linkedin className="w-4 h-4" />
                </a>

                {/* Instagram */}
                <a
                  href={SOCIAL_CONFIG.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Profile"
                  title="Connect on Instagram"
                  className="w-9 h-9 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#E4405F] hover:bg-[#E4405F] hover:text-white hover:border-[#E4405F] transition-all shadow-2xs"
                >
                  <Instagram className="w-4 h-4" />
                </a>

                {/* Email */}
                <a
                  href={`mailto:${SOCIAL_CONFIG.recipientEmail}`}
                  aria-label="Direct Email"
                  title={`Email ${SOCIAL_CONFIG.recipientEmail}`}
                  className="w-9 h-9 rounded-md bg-white border border-[#E5DFD5] flex items-center justify-center text-[#0F5132] hover:bg-[#0F5132] hover:text-white hover:border-[#0F5132] transition-all shadow-2xs"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>

              {/* Prominent "Contact Me" Button */}
              {onNavigateToContact ? (
                <button
                  type="button"
                  onClick={onNavigateToContact}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5132] hover:bg-[#064E3B] text-white rounded-md text-xs font-semibold tracking-wide transition-colors shadow-xs group cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact Me</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5132] hover:bg-[#064E3B] text-white rounded-md text-xs font-semibold tracking-wide transition-colors shadow-xs group"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact Me</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Institutional Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-[#0F5132]">
              <Archive className="w-5 h-5" />
              <span className="text-lg font-serif-academic font-bold tracking-tight text-[#0F5132]">
                Athenaeum Digital Question-Paper Archive
              </span>
            </div>
            <p className="text-xs leading-relaxed max-w-md text-[#5C6F68]">
              The official centralized institutional repository for undergraduate B.Tech previous year examination papers, midterm assessments, and unit evaluations. Maintained under the auspices of the Office of the Controller of Examinations.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5C6F68] pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F5132]" /> Autonomous Engineering Affiliation
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#0F5132]" /> Academic Integrity Standard
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#1C2826] uppercase tracking-wider mb-3">
              Examination Categories
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>University End-Semester Exams</li>
              <li>Midterm Examinations 1 & 2</li>
              <li>Unit Evaluation Tests (UT 1 & 2)</li>
              <li>Laboratory Viva & Practical Models</li>
              <li>Remedial & Supplementary Archives</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#1C2826] uppercase tracking-wider mb-3">
              Academic Curricula
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>B.Tech 1st Year (Foundations)</li>
              <li>B.Tech 2nd Year (Core Modules)</li>
              <li>B.Tech 3rd Year (Advanced Specialization)</li>
              <li>B.Tech 4th Year (Electives & Capstone)</li>
              <li>Autonomous Regulation 2024–2026</li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="border-t border-[#E5DFD5] pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#5C6F68] gap-4">
          <p>© {new Date().getFullYear()} Athenaeum Institute of Higher Technology. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs">
            {onNavigateToContact ? (
              <button
                type="button"
                onClick={onNavigateToContact}
                className="hover:text-[#0F5132] transition-colors font-medium underline-offset-2 hover:underline cursor-pointer"
              >
                Contact & Support
              </button>
            ) : (
              <a href="/contact" className="hover:text-[#0F5132] transition-colors font-medium">
                Contact & Support
              </a>
            )}
            <span>·</span>
            <span>Repository Regulations</span>
            <span>·</span>
            <span>Examination Cell Portal</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
