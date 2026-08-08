import React, { useState, useMemo } from "react";
import { Search, RefreshCw, Users, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Student } from "../types";

interface StudentDetailsProps {
  students: Student[];
  onRefresh: () => void;
}

export default function StudentDetails({ students, onRefresh }: StudentDetailsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Filter students based on search term (reg_no, name, department, year)
  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => 
      s.reg_no.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.department || "").toLowerCase().includes(q) ||
      (s.year || "").toLowerCase().includes(q)
    );
  }, [students, searchTerm]);

  // Pagination calculation
  const totalEntries = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const validPage = Math.min(currentPage, totalPages);

  const startIndex = (validPage - 1) * entriesPerPage;
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredStudents, startIndex, entriesPerPage]);

  return (
    <div className="space-y-6">
      {/* 1. Top Header Banner - Saffron / Amber Theme */}
      <div className="bg-white text-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-200 border-t-4 border-t-[#FF9933]">
        <div className="bg-amber-50/60 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/80 rounded-xl border border-amber-200 text-[#FF9933]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide uppercase font-sans text-slate-900 flex items-center gap-2">
                Students In Course : ALL ENROLLED STUDENTS [STUDENT MEALS ROSTER]
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Ramakrishna Mission Vivekananda College (Autonomous) — Staff Directory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white text-[#FF9933] text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
              Total Enrolled: {students.length} Students
            </span>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FF9933] hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Refresh Roster from Server"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 w-full sm:w-auto">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-[#FF9933] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          {/* Search Input Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Regn. No, Name, Program..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 text-slate-800 text-xs placeholder-slate-400 pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF9933] font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Student Details Table View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-amber-50/50 border-b border-amber-100 text-slate-800 uppercase text-[11px] font-extrabold tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4 w-24">Image</th>
                <th className="py-3.5 px-4 w-44">Regn. No.</th>
                <th className="py-3.5 px-4 min-w-[200px]">Name</th>
                <th className="py-3.5 px-4 min-w-[220px]">Program</th>
                <th className="py-3.5 px-4 w-32">Semester / Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-xs font-medium">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student, idx) => {
                  const globalIndex = startIndex + idx + 1;
                  const avatarUrl = student.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=0D8ABC&color=fff`;

                  return (
                    <tr 
                      key={student.reg_no} 
                      className="hover:bg-amber-50/20 transition-colors group cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      {/* # Counter */}
                      <td className="py-3 px-4 text-center font-bold text-slate-400 group-hover:text-slate-600">
                        {globalIndex}
                      </td>

                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-2xs shrink-0 flex items-center justify-center">
                          <img
                            src={avatarUrl}
                            alt={student.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).setAttribute(
                                "src",
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=FA9632&color=fff`
                              );
                            }}
                          />
                        </div>
                      </td>

                      {/* Regn. No. */}
                      <td className="py-3 px-4 font-mono font-bold text-[#FF9933] group-hover:text-amber-600 tracking-wide text-xs">
                        {student.reg_no}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900 uppercase tracking-wide">
                        {student.name}
                      </td>

                      {/* Program */}
                      <td className="py-3 px-4 text-slate-700 font-semibold uppercase">
                        {student.department}
                      </td>

                      {/* Semester / Year */}
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-[11px] font-bold">
                          {student.year && student.year !== 'Enrolled' ? student.year : 'Unspecified'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-semibold">No students found matching your criteria.</p>
                      <p className="text-xs text-slate-400">Try adjusting your search query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination Controls */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 font-semibold">
          <div>
            Showing {totalEntries === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, totalEntries)} of {totalEntries} entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={validPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 bg-[#FF9933] text-white font-bold rounded-md shadow-2xs">
              {validPage} / {totalPages}
            </span>

            <button
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* View-Only Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-500 text-white px-5 py-4 flex items-center justify-between border-b border-amber-600">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-100" />
                <span>Student Record Profile (View-Only)</span>
              </h3>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-amber-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-16 h-20 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-2xs shrink-0">
                  <img
                    src={selectedStudent.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStudent.name)}&background=FA9632&color=fff`}
                    alt={selectedStudent.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 uppercase">{selectedStudent.name}</h4>
                  <p className="text-xs font-bold font-mono text-[#FF9933] mt-0.5">REG: {selectedStudent.reg_no}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                    Read-Only Record
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Program / Department</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{selectedStudent.department}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Semester / Year</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{selectedStudent.year}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Forenoon Meal</span>
                  <span className={`font-bold block mt-0.5 ${selectedStudent.forenoon_meal !== false ? "text-emerald-700" : "text-slate-400"}`}>
                    {selectedStudent.forenoon_meal !== false ? "Eligible" : "Not Enrolled"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Afternoon Meal</span>
                  <span className={`font-bold block mt-0.5 ${selectedStudent.afternoon_meal !== false ? "text-emerald-700" : "text-slate-400"}`}>
                    {selectedStudent.afternoon_meal !== false ? "Eligible" : "Not Enrolled"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Staff Editing Disabled</span>
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-1.5 bg-[#FF9933] hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
