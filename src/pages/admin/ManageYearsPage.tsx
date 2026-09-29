import React, { useState } from 'react';
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { Paper } from '../../types';
import { api } from '../../services/api';

interface ManageYearsPageProps {
  years: string[];
  papers: Paper[];
  onYearsUpdated: (updatedYears: string[]) => void;
}

export const ManageYearsPage: React.FC<ManageYearsPageProps> = ({
  years,
  papers,
  onYearsUpdated,
}) => {
  const [newYear, setNewYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.trim()) return;

    setLoading(true);
    setError('');

    try {
      const updated = await api.addYear(newYear.trim());
      onYearsUpdated(updated);
      setNewYear('');
    } catch (err: any) {
      setError(err.message || 'Could not add academic year.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteYear = async (yr: string) => {
    try {
      const updated = await api.deleteYear(yr);
      onYearsUpdated(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
          Temporal Classification
        </span>
        <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
          Manage Academic Batches & Years
        </h2>
        <p className="text-xs text-[#5C6F68] mt-0.5">
          Provision new academic years (e.g. 2027, 2028) for examination paper archiving and filtering.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Add Year Form */}
        <div className="md:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-serif-academic font-bold text-[#1C2826] mb-3">
            Add New Academic Year
          </h3>

          {error && (
            <div className="mb-3 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleAddYear} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Year Designation
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2027 or 2027-2028"
                value={newYear}
                onChange={e => setNewYear(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
              />
              <span className="text-[11px] text-[#5C6F68] mt-1 block">
                Standard format: 4-digit year (e.g. 2027)
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Adding Year...' : 'Register Academic Year'}</span>
            </button>
          </form>
        </div>

        {/* Existing Years List */}
        <div className="md:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-[#1C2826] mb-4">
            Active Academic Years in Archive ({years.length})
          </h3>

          <div className="space-y-2">
            {years.map((yr) => {
              const count = papers.filter(p => p.academicYear === yr).length;
              return (
                <div
                  key={yr}
                  className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#0F5132]" />
                    <span className="font-mono-code font-bold text-sm text-[#1C2826]">{yr}</span>
                    <span className="text-[#5C6F68] font-mono-code">({count} archived {count === 1 ? 'paper' : 'papers'})</span>
                  </div>

                  <button
                    onClick={() => handleDeleteYear(yr)}
                    className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                    title="Delete Academic Year"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
