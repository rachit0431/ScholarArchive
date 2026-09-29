import React, { useState } from 'react';
import { Plus, Trash2, Layers, AlertCircle } from 'lucide-react';
import { Paper } from '../../types';
import { api } from '../../services/api';

interface ManageExamTypesPageProps {
  examTypes: string[];
  papers: Paper[];
  onExamTypesUpdated: (updatedTypes: string[]) => void;
}

export const ManageExamTypesPage: React.FC<ManageExamTypesPageProps> = ({
  examTypes,
  papers,
  onExamTypesUpdated,
}) => {
  const [newType, setNewType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.trim()) return;

    setLoading(true);
    setError('');

    try {
      const updated = await api.addExamType(newType.trim());
      onExamTypesUpdated(updated);
      setNewType('');
    } catch (err: any) {
      setError(err.message || 'Could not add exam type.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (t: string) => {
    try {
      const updated = await api.deleteExamType(t);
      onExamTypesUpdated(updated);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
          Assessment Schema
        </span>
        <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
          Manage Examination Categories
        </h2>
        <p className="text-xs text-[#5C6F68] mt-0.5">
          Configure evaluation tiers such as Unit Tests, Midterms, Lab Assessments, and University Finals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Add Exam Type Form */}
        <div className="md:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-serif-academic font-bold text-[#1C2826] mb-3">
            Add New Examination Category
          </h3>

          {error && (
            <div className="mb-3 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleAddType} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Category Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Model Practical Exam"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Registering...' : 'Add Assessment Category'}</span>
            </button>
          </form>
        </div>

        {/* Existing Exam Types List */}
        <div className="md:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-[#1C2826] mb-4">
            Active Examination Schemes ({examTypes.length})
          </h3>

          <div className="space-y-2">
            {examTypes.map((type) => {
              const count = papers.filter(p => p.examType.toLowerCase() === type.toLowerCase()).length;
              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-[#0F5132]" />
                    <span className="font-semibold text-sm text-[#1C2826]">{type}</span>
                    <span className="text-[#5C6F68] font-mono-code">({count} papers)</span>
                  </div>

                  <button
                    onClick={() => handleDeleteType(type)}
                    className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                    title="Delete Category"
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
