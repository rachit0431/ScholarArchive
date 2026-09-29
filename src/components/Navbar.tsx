import React, { useState } from 'react';
import { BookOpen, User, Shield, LogOut, Bookmark, FileText, Search, Menu, X, PlusCircle, Mail, GraduationCap } from 'lucide-react';
import { StudentUser, AdminUser } from '../types';
import { ASSETS } from '../assets/images';

export type NavView = 'home' | 'library' | 'archive' | 'search' | 'profile' | 'admin' | 'contact' | 'notes';

interface NavbarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  currentStudent: StudentUser | null;
  currentAdmin: AdminUser | null;
  onOpenStudentLogin: () => void;
  onOpenStudentSignup: () => void;
  onOpenAdminLogin: () => void;
  onStudentSignOut: () => void;
  onAdminSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentStudent,
  currentAdmin,
  onOpenStudentLogin,
  onOpenStudentSignup,
  onOpenAdminLogin,
  onStudentSignOut,
  onAdminSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: NavView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E5DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Zone 1: College Emblem + Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (currentAdmin) {
                handleNavClick('admin');
              } else {
                handleNavClick('home');
              }
            }}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <img
              src={ASSETS.collegeEmblem}
              alt="Athenaeum Crest"
              className="w-9 h-9 object-cover rounded-md border border-[#E5DFD5] shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-xl sm:text-2xl font-serif-academic font-bold tracking-tight text-[#0F5132] block leading-none">
                Athenaeum
              </span>
              <span className="text-[10px] tracking-widest text-[#5C6F68] uppercase font-medium">
                Examination Archives & Question Bank
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Desktop Navigation Links (Only for Authenticated Users) */}
        {(currentStudent || currentAdmin) ? (
          <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium text-[#1C2826]">
            {/* Home Link */}
            <button
              onClick={() => handleNavClick('home')}
              className={`transition-colors hover:text-[#0F5132] ${
                currentView === 'home'
                  ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                  : 'text-[#5C6F68]'
              }`}
            >
              <span>Home</span>
            </button>

            {/* Dedicated Question Papers Library Tab (Both Student & Admin) */}
            <button
              onClick={() => handleNavClick('library')}
              className={`transition-colors hover:text-[#0F5132] flex items-center gap-1.5 ${
                currentView === 'library'
                  ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                  : 'text-[#5C6F68]'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#0F5132]" />
              <span>Question Papers Library</span>
            </button>

            {/* Dedicated Notes Library Tab (Both Student & Admin) */}
            <button
              onClick={() => handleNavClick('notes')}
              className={`transition-colors hover:text-[#0F5132] flex items-center gap-1.5 ${
                currentView === 'notes'
                  ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                  : 'text-[#5C6F68]'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#0F5132]" />
              <span>Notes Library</span>
            </button>

            {currentStudent && (
              <>
                <button
                  onClick={() => handleNavClick('archive')}
                  className={`transition-colors hover:text-[#0F5132] ${
                    currentView === 'archive'
                      ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                      : 'text-[#5C6F68]'
                  }`}
                >
                  Papers Archive
                </button>
                <button
                  onClick={() => handleNavClick('search')}
                  className={`transition-colors hover:text-[#0F5132] ${
                    currentView === 'search'
                      ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                      : 'text-[#5C6F68]'
                  }`}
                >
                  Search Catalog
                </button>
                <button
                  onClick={() => handleNavClick('profile')}
                  className={`transition-colors hover:text-[#0F5132] ${
                    currentView === 'profile'
                      ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                      : 'text-[#5C6F68]'
                  }`}
                >
                  My Archive ({((currentStudent.savedPapers?.length ?? currentStudent.bookmarks?.length ?? 0) + (currentStudent.savedNotes?.length || 0))})
                </button>
              </>
            )}
            {currentAdmin && (
              <button
                onClick={() => handleNavClick('admin')}
                className={`transition-colors hover:text-[#0F5132] flex items-center gap-1.5 ${
                  currentView === 'admin'
                    ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                    : 'text-[#0F5132] font-medium'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {/* Direct Contact Navigation Tab */}
            <button
              onClick={() => handleNavClick('contact')}
              className={`transition-colors hover:text-[#0F5132] flex items-center gap-1.5 ${
                currentView === 'contact'
                  ? 'text-[#0F5132] font-semibold border-b-2 border-[#0F5132] pb-0.5'
                  : 'text-[#5C6F68]'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
              <span>Contact</span>
            </button>
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#5C6F68] bg-[#F5F1EB] px-3.5 py-1.5 rounded-full border border-[#E5DFD5]">
              <Shield className="w-3.5 h-3.5 text-[#0F5132]" />
              <span>Restricted Access · Institutional Sign In Required</span>
            </div>
            <button
              onClick={() => handleNavClick('contact')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                currentView === 'contact'
                  ? 'text-[#0F5132] bg-[#E8F5E9] font-semibold border border-[#A7F3D0]'
                  : 'text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#FAF8F5] border border-transparent'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
              <span>Contact Desk</span>
            </button>
          </div>
        )}

        {/* Zone 3: Actions & Auth Triggers */}
        <div className="flex items-center gap-3">
          {currentAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavClick('admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F5132] bg-[#E8F5E9] border border-[#A7F3D0] rounded-md hover:bg-[#D1FAE5] transition-colors whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>
              <button
                onClick={onAdminSignOut}
                title="Exit Admin Panel"
                className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : currentStudent ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavClick('profile')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] rounded-md hover:bg-[#F5F1EB] transition-colors shadow-2xs whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-[#0F5132]" />
                <span className="hidden sm:inline font-semibold">{currentStudent.name.split(' ')[0]}</span>
                <span className="hidden lg:inline text-[#5C6F68]">({currentStudent.semester})</span>
              </button>

              <button
                onClick={onStudentSignOut}
                title="Sign Out"
                className="p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavClick('contact')}
                className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#5C6F68] hover:text-[#0F5132] border border-[#E5DFD5] rounded-md"
                title="Contact Desk"
              >
                <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
              </button>
              <button
                onClick={onOpenStudentLogin}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs whitespace-nowrap"
              >
                Student Sign In
              </button>
              <button
                onClick={onOpenAdminLogin}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#5C6F68] hover:text-[#0F5132] hover:bg-[#E8F5E9]/60 border border-[#E5DFD5] rounded-md transition-colors whitespace-nowrap"
              >
                <Shield className="w-3 h-3 text-[#0F5132]" />
                <span>Admin</span>
              </button>
            </div>
          )}

          {/* Mobile Navigation Menu Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#5C6F68] hover:text-[#1C2826] bg-[#FFFFFF] border border-[#E5DFD5] rounded-md"
              title="Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5DFD5] bg-[#FFFFFF] px-4 py-4 space-y-2">
          {currentStudent ? (
            <>
              <button
                onClick={() => handleNavClick('home')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-2 ${
                  currentView === 'home' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <span>Home</span>
              </button>
              <button
                onClick={() => handleNavClick('library')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-2 ${
                  currentView === 'library' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Question Papers Library</span>
              </button>
              <button
                onClick={() => handleNavClick('notes')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-2 ${
                  currentView === 'notes' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Notes Library</span>
              </button>
              <button
                onClick={() => handleNavClick('archive')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${
                  currentView === 'archive' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                Question Paper Archive
              </button>
              <button
                onClick={() => handleNavClick('search')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${
                  currentView === 'search' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                Search Catalog
              </button>
              <button
                onClick={() => handleNavClick('profile')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${
                  currentView === 'profile' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                My Archive ({((currentStudent.savedPapers?.length ?? currentStudent.bookmarks?.length ?? 0) + (currentStudent.savedNotes?.length || 0))})
              </button>
              <button
                onClick={() => handleNavClick('contact')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-1.5 ${
                  currentView === 'contact' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Contact Desk</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStudentSignOut();
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2] flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : currentAdmin ? (
            <>
              <button
                onClick={() => handleNavClick('library')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-2 ${
                  currentView === 'library' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Question Papers Library</span>
              </button>
              <button
                onClick={() => handleNavClick('notes')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-2 ${
                  currentView === 'notes' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Notes Library</span>
              </button>
              <button
                onClick={() => handleNavClick('admin')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium ${
                  currentView === 'admin' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#0F5132]'
                }`}
              >
                Admin Dashboard & Repository
              </button>
              <button
                onClick={() => handleNavClick('contact')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center gap-1.5 ${
                  currentView === 'contact' ? 'bg-[#E8F5E9] text-[#0F5132] font-semibold' : 'text-[#1C2826]'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Contact Desk</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onAdminSignOut();
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2] flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Admin</span>
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleNavClick('contact')}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium text-[#1C2826] bg-[#FAF8F5] border border-[#E5DFD5] flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Contact Support Desk</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenStudentLogin();
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium text-white bg-[#0F5132] flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Student Sign In / Register</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdminLogin();
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-medium text-[#0F5132] border border-[#A7F3D0] bg-[#E8F5E9]/50 flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Portal Sign In</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
