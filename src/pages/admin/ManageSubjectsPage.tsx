import React, { useState } from 'react';
import { Plus, Trash2, BookOpen, AlertCircle } from 'lucide-react';
import { Subject } from '../../types';
import { api } from '../../services/api';

interface ManageSubjectsPageProps {
  subjects: Subject[];
  onSubjectAdded: (subject: Subject) => void;
  onSubjectDeleted: (id: string) => void;
}

export const ManageSubjectsPage: React.FC<ManageSubjectsPageProps> = ({
  subjects,
  onSubjectAdded,
  onSubjectDeleted,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [btechYear, setBtechYear] = useState('3rd Year');
  const [semester, setSemester] = useState('Semester 5');
  const [credits, setCredits] = useState('4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Subject Name and Code are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const created = await api.addSubject({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        department,
        btechYear,
        semester,
        credits: parseInt(credits) || 4,
      });
      onSubjectAdded(created);
      setName('');
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to add subject.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSubject(id);
      onSubjectDeleted(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-[#0F5132]">
          Curricular Taxonomy
        </span>
        <h2 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
          Manage Academic Subjects
        </h2>
        <p className="text-xs text-[#5C6F68] mt-0.5">
          Define approved undergraduate course modules and departmental allocations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add Subject Form */}
        <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-serif-academic font-bold text-[#1C2826] mb-3">
            Add New Course Subject
          </h3>

          {error && (
            <div className="mb-4 p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Subject Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Distributed Computing"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Subject Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS604"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Credits
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={credits}
                  onChange={e => setCredits(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] font-mono-code"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Academic Department
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Basic Sciences & Humanities">Basic Sciences & Humanities</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  B.Tech Year
                </label>
                <select
                  value={btechYear}
                  onChange={e => setBtechYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Adding Subject...' : 'Register Subject in Catalog'}</span>
            </button>
          </form>
        </div>

        {/* Existing Subjects List */}
        <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD5] rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E5DFD5] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C2826]">
              Registered Curricular Subjects ({subjects.length})
            </h3>
            <span className="text-[11px] text-[#5C6F68]">B.Tech Autonomous Curriculum</span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#E5DFD5] text-[#5C6F68] uppercase font-mono-code text-[11px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Code & Name</th>
                  <th className="py-2.5 px-3">Year / Sem</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD5]">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#FAF8F5]">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#1C2826]">{sub.name}</div>
                      <div className="text-[11px] text-[#0F5132] font-mono-code">{sub.code} · {sub.department}</div>
                    </td>
                    <td className="py-3 px-3 text-[#5C6F68]">
                      <div>{sub.btechYear}</div>
                      <div className="text-[11px]">{sub.semester}</div>
                    </td>
                    <td className="py-3 px-3 font-mono-code font-semibold">
                      {sub.credits}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="p-1.5 text-[#5C6F68] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
