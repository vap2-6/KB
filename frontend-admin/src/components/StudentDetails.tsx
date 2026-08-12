import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  RefreshCw, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  AlertTriangle,
  User,
  ShieldCheck,
  GraduationCap
} from "lucide-react";
import api from "../lib/api";

export interface Student {
  reg_no: string;
  name: string;
  year: string;
  department: string;
  student_category?: string;
  image_url?: string;
  forenoon_meal?: boolean;
  afternoon_meal?: boolean;
  mobile_no?: string;
  email?: string;
}

interface StudentDetailsProps {
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

const formatAcademicYear = (val: any): string => {
  if (!val) return "Unspecified";
  const s = String(val).trim();
  const sLower = s.toLowerCase();
  if (sLower === "enrolled" || sLower === "" || sLower === "n/a" || sLower === "null") {
    return "Unspecified";
  }
  if (sLower === "1" || sLower.includes("1st") || sLower === "i" || sLower === "first") {
    return "1st Year";
  }
  if (sLower === "2" || sLower.includes("2nd") || sLower === "ii" || sLower === "second") {
    return "2nd Year";
  }
  if (sLower === "3" || sLower.includes("3rd") || sLower === "iii" || sLower === "third") {
    return "3rd Year";
  }
  if (sLower.includes("graduat")) {
    return "Graduated";
  }
  if (sLower.includes("year")) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return `${s} Year`;
};

export default function StudentDetails({ showToast }: StudentDetailsProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [entriesPerPage, setEntriesPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState<boolean>(false);
  const [promoting, setPromoting] = useState<boolean>(false);

  const handlePromoteAcademicYear = async () => {
    setPromoting(true);
    try {
      const res = await api.post('/students/promote-academic-year');
      if (res.data && (res.data.message || res.status === 200)) {
        showToast(res.data.message || "Academic year promoted successfully!", "success");
        setIsPromoteModalOpen(false);
        fetchStudents();
      } else {
        showToast(res.data.error || "Failed to promote academic year", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || err.message || "Failed to promote academic year", "error");
    } finally {
      setPromoting(false);
    }
  };

  // New / Edit Form States
  const [formData, setFormData] = useState<{
    reg_no: string;
    name: string;
    department: string;
    year: string;
    student_category: string;
    forenoon_meal: boolean;
    afternoon_meal: boolean;
    email: string;
    mobile_no: string;
  }>({
    reg_no: "",
    name: "",
    department: "Computer Applications",
    year: "1st Year",
    student_category: "Regular",
    forenoon_meal: true,
    afternoon_meal: true,
    email: "",
    mobile_no: ""
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch Students from backend API
  const fetchStudents = async () => {
    setLoading(true);
    try {
      // First try /api/students from staff API
      const res = await api.get('/students');
      const studentRows = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.students || res.data?.rows || []);

      if (studentRows.length > 0) {
        const mapped: Student[] = studentRows.map((s: any) => ({
          reg_no: String(s.reg_no || s.student_id || ""),
          name: s.name || "Unknown Student",
          department: s.department || s.grade_section || "General",
          year: formatAcademicYear(s.degree_year || s.year),
          student_category: s.student_category || "Regular",
          image_url: s.image_url || s.image_path || s.student_image_path || "",
          forenoon_meal: s.forenoon_meal !== false && s.forenoon_meal !== 0,
          afternoon_meal: s.afternoon_meal !== false && s.afternoon_meal !== 0,
          mobile_no: s.mobile_no || "",
          email: s.email || ""
        }));
        setStudents(mapped);
      } else {
        // Fallback to /tables/student_meals
        const tableRes = await api.get('/tables/student_meals');
        const rows = tableRes.data.rows || [];
        const mapped: Student[] = rows.map((s: any) => ({
          reg_no: String(s.student_id || s.reg_no || ""),
          name: s.name || "Unknown Student",
          department: s.grade_section || s.department || "General",
          year: formatAcademicYear(s.degree_year || s.year),
          student_category: s.student_category || "Regular",
          image_url: s.image_url || s.image_path || "",
          forenoon_meal: s.forenoon_meal !== false && s.forenoon_meal !== 0,
          afternoon_meal: s.afternoon_meal !== false && s.afternoon_meal !== 0,
          mobile_no: s.mobile_no || "",
          email: s.email || ""
        }));
        setStudents(mapped);
      }
    } catch (err: any) {
      showToast("Failed to fetch student details roster", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search term and category
  const filteredStudents = useMemo(() => {
    let list = students;
    if (categoryFilter !== "all") {
      list = list.filter((s) => (s.student_category || "Regular").toUpperCase() === categoryFilter.toUpperCase());
    }
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.reg_no.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q) ||
        (s.year || "").toLowerCase().includes(q) ||
        (s.student_category || "").toLowerCase().includes(q)
    );
  }, [students, searchTerm, categoryFilter]);

  // Pagination calculation
  const totalEntries = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const validPage = Math.min(currentPage, totalPages);

  const startIndex = (validPage - 1) * entriesPerPage;
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(startIndex, startIndex + entriesPerPage);
  }, [filteredStudents, startIndex, entriesPerPage]);

  // Handle Edit Click
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      reg_no: student.reg_no,
      name: student.name,
      department: student.department || "Computer Applications",
      year: student.year || "1st Year",
      forenoon_meal: student.forenoon_meal !== false,
      afternoon_meal: student.afternoon_meal !== false,
      email: student.email || "",
      mobile_no: student.mobile_no || ""
    });
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSubmitting(true);

    try {
      const payload = {
        targetTableName: "student_meals",
        name: formData.name,
        grade_section: formData.department,
        degree_year: formData.year,
        forenoon_meal: formData.forenoon_meal ? 1 : 0,
        afternoon_meal: formData.afternoon_meal ? 1 : 0,
        email: formData.email,
        mobile_no: formData.mobile_no
      };

      await api.put(`/records/${editingStudent.reg_no}`, payload);

      showToast(`Student record for ${formData.name} (${editingStudent.reg_no}) updated successfully!`, "success");
      setEditingStudent(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to update student details", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      reg_no: `STU${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      department: "Computer Applications",
      year: "1st Year",
      forenoon_meal: true,
      afternoon_meal: true,
      email: "",
      mobile_no: ""
    });
    setIsAddModalOpen(true);
  };

  // Handle Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reg_no || !formData.name) {
      showToast("Registration Number and Name are required", "error");
      return;
    }
    setSubmitting(true);

    try {
      const payload = {
        student_id: formData.reg_no,
        name: formData.name,
        grade_section: formData.department,
        degree_year: formData.year,
        forenoon_meal: formData.forenoon_meal ? 1 : 0,
        afternoon_meal: formData.afternoon_meal ? 1 : 0,
        email: formData.email,
        mobile_no: formData.mobile_no
      };

      await api.post("/tables/student_meals/records", payload);

      showToast(`New student ${formData.name} added successfully!`, "success");
      setIsAddModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Failed to create student record", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStudentAvatarUrl = (student: Student) => {
    const url = student.image_url;
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))) {
      return url;
    }
    if (url && url.startsWith('/')) {
      return url;
    }
    if (url && !url.includes('ui-avatars.com')) {
      return `/uploads/student_master_img/${url}`;
    }
    if (student.reg_no) {
      return `/uploads/student_master_img/${student.reg_no}.jpeg`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=FA9632&color=fff`;
  };

  // Handle Delete Confirmation
  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setSubmitting(true);

    try {
      await api.delete(`/records/${studentToDelete.reg_no}?tableName=student_meals`);
      showToast(`Student record for ${studentToDelete.name} (${studentToDelete.reg_no}) deleted successfully`, "success");
      setStudentToDelete(null);
      fetchStudents();
    } catch (err: any) {
      try {
        await api.delete(`/students/${studentToDelete.reg_no}`);
        showToast(`Student record for ${studentToDelete.name} deleted successfully`, "success");
        setStudentToDelete(null);
        fetchStudents();
      } catch (err2: any) {
        showToast(err2.response?.data?.error || err.response?.data?.error || "Failed to delete student record", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50">
      {/* 1. Top Header Banner - Saffron / Amber Theme (Mirrors Staff Portal) */}
      <div className="bg-white text-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-200 border-t-4 border-t-saffron-500">
        <div className="bg-saffron-50/70 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-saffron-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-saffron-100/80 rounded-xl border border-saffron-200 text-saffron-600 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide uppercase font-sans text-slate-900 flex items-center gap-2">
                Student Meals Roster
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-white text-saffron-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-saffron-200 shadow-2xs">
              Total Enrolled: {students.length} Students
            </span>
            <button
              onClick={fetchStudents}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Roster from Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-saffron-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsPromoteModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition-all border border-amber-300 shadow-2xs cursor-pointer active:scale-95"
              title="Promote all students to next academic year (1st -> 2nd -> 3rd -> Graduated)"
            >
              <GraduationCap className="w-4 h-4 text-amber-700" />
              <span>Promote Academic Year</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-saffron-500 hover:bg-saffron-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add Student</span>
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
              className="bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-saffron-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>

          {/* Search Input Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Regn. No, Name, Program, Year..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 text-slate-800 text-xs placeholder-slate-400 pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-medium transition-all shadow-2xs"
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

          {/* Category Filter Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 cursor-pointer shadow-2xs"
          >
            <option value="all">All Categories</option>
            <option value="Regular">Regular Students</option>
            <option value="NCC">NCC Cadets</option>
          </select>
        </div>
      </div>

      {/* 2. Main Student Details Table View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-saffron-50/50 border-b border-saffron-100 text-slate-800 uppercase text-[11px] font-extrabold tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4 w-20">Image</th>
                <th className="py-3.5 px-4 w-36">Regn. No.</th>
                <th className="py-3.5 px-4 min-w-[180px]">Name</th>
                <th className="py-3.5 px-4 min-w-[200px]">Program</th>
                <th className="py-3.5 px-4 w-32">Semester / Year</th>
                <th className="py-3.5 px-4 w-28 text-center">Category</th>
                <th className="py-3.5 px-4 w-28 text-center">Forenoon</th>
                <th className="py-3.5 px-4 w-28 text-center">Afternoon</th>
                <th className="py-3.5 px-4 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-xs font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 text-saffron-500 animate-spin" />
                      <p className="text-xs font-semibold">Loading student roster...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((student, idx) => {
                  const globalIndex = startIndex + idx + 1;
                  const avatarUrl = getStudentAvatarUrl(student);

                  return (
                    <tr
                      key={student.reg_no}
                      onClick={() => setViewingStudent(student)}
                      className="hover:bg-saffron-50/20 transition-colors group cursor-pointer"
                    >
                      {/* # Counter */}
                      <td className="py-3 px-4 text-center font-bold text-slate-400 group-hover:text-slate-600">
                        {globalIndex}
                      </td>

                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-10 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-2xs shrink-0 flex items-center justify-center">
                          <img
                            src={avatarUrl}
                            alt={student.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const currentSrc = target.src || "";
                              if (currentSrc.endsWith('.jpeg')) {
                                target.src = currentSrc.replace(/\.jpeg$/, '.jpg');
                              } else if (currentSrc.endsWith('.jpg')) {
                                target.src = currentSrc.replace(/\.jpg$/, '.png');
                              } else if (!currentSrc.includes('ui-avatars.com')) {
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=FA9632&color=fff`;
                              }
                            }}
                          />
                        </div>
                      </td>

                      {/* Regn. No. */}
                      <td className="py-3 px-4 font-mono font-bold text-saffron-600 tracking-wide text-xs">
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
                        <span className="inline-block px-2.5 py-1 bg-saffron-50 text-saffron-800 rounded-md border border-saffron-200 text-[11px] font-bold">
                          {student.year}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold border uppercase tracking-wider ${
                            (student.student_category || "Regular").toUpperCase() === "NCC"
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {(student.student_category || "Regular").toUpperCase() === "NCC" ? "NCC Cadet" : "Regular"}
                        </span>
                      </td>

                      {/* Forenoon Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            student.forenoon_meal !== false
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {student.forenoon_meal !== false ? "Eligible" : "Disabled"}
                        </span>
                      </td>

                      {/* Afternoon Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            student.afternoon_meal !== false
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {student.afternoon_meal !== false ? "Eligible" : "Disabled"}
                        </span>
                      </td>

                      {/* Admin Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStudentToDelete(student);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
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
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 bg-saffron-500 text-white font-bold rounded-md shadow-2xs">
              {validPage} / {totalPages}
            </span>

            <button
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. EDIT STUDENT MODAL (ADMIN ACCESS) */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-saffron-500 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-saffron-100" />
                <span>Edit Student Profile (Admin Access)</span>
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-saffron-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Registration Number & Avatar Header */}
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-16 h-20 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-2xs shrink-0 flex items-center justify-center">
                  <img
                    src={
                      formData.image_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || "Student")}&background=FA9632&color=fff`
                    }
                    alt={formData.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Registration Number</span>
                  <span className="text-sm font-bold font-mono text-saffron-600 block mt-0.5">{editingStudent.reg_no}</span>
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3" />
                    Admin Direct Editable
                  </span>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Student Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold"
                  />
                </div>

                {/* Program / Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Program / Department</label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold"
                  />
                </div>

                {/* Semester / Year */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Semester / Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold cursor-pointer"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="PG 1st Year">PG 1st Year</option>
                    <option value="PG 2nd Year">PG 2nd Year</option>
                  </select>
                </div>

                {/* Forenoon Meal Toggle */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 block">Forenoon Meal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Breakfast Eligibility</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.forenoon_meal}
                    onChange={(e) => setFormData({ ...formData, forenoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500 cursor-pointer"
                  />
                </div>

                {/* Afternoon Meal Toggle */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 block">Afternoon Meal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Lunch Eligibility</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.afternoon_meal}
                    onChange={(e) => setFormData({ ...formData, afternoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500 cursor-pointer"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Student Email Address</label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-medium"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formData.mobile_no}
                    onChange={(e) => setFormData({ ...formData, mobile_no: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-slate-50 -mx-6 -mb-6 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. QUICK ADD STUDENT MODAL (ADMIN ACCESS) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-saffron-500 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-saffron-100" />
                <span>Quick Add Student (Admin Access)</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-saffron-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Registration Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 243301034025"
                    value={formData.reg_no}
                    onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-mono font-bold"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Student Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Akash Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold"
                  />
                </div>

                {/* Program / Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Program / Department</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B.Sc. Comp Sci"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold"
                  />
                </div>

                {/* Semester / Year */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Semester / Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-semibold cursor-pointer"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="PG 1st Year">PG 1st Year</option>
                    <option value="PG 2nd Year">PG 2nd Year</option>
                  </select>
                </div>

                {/* Forenoon Meal Toggle */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 block">Forenoon Meal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Eligible</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.forenoon_meal}
                    onChange={(e) => setFormData({ ...formData, forenoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500 cursor-pointer"
                  />
                </div>

                {/* Afternoon Meal Toggle */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 block">Afternoon Meal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Eligible</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.afternoon_meal}
                    onChange={(e) => setFormData({ ...formData, afternoon_meal: e.target.checked })}
                    className="w-4 h-4 text-saffron-500 rounded border-slate-300 focus:ring-saffron-500 cursor-pointer"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Student Email Address</label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-medium"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formData.mobile_no}
                    onChange={(e) => setFormData({ ...formData, mobile_no: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-saffron-500 font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-slate-50 -mx-6 -mb-6 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DELETE CONFIRMATION MODAL */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Student Record?</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to remove <span className="font-bold text-slate-900">{studentToDelete.name}</span> (<span className="font-mono text-saffron-600 font-bold">{studentToDelete.reg_no}</span>) from the active dining roster?
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteStudent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PROMOTE ACADEMIC YEAR CONFIRMATION MODAL */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-amber-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Promote All Academic Years?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This action will advance all enrolled students in the dining roster for the new academic session:
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-xs space-y-1.5 font-semibold text-amber-900">
                <div className="flex items-center justify-between">
                  <span>1st Year Students</span>
                  <span className="font-bold text-emerald-700">➜ 2nd Year</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>2nd Year Students</span>
                  <span className="font-bold text-emerald-700">➜ 3rd Year</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>3rd Year Students</span>
                  <span className="font-bold text-rose-700">➜ Graduated (Meal Token Disabled)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Are you sure you want to proceed with annual student migration?
              </p>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={promoting}
                onClick={() => setIsPromoteModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={promoting}
                onClick={handlePromoteAcademicYear}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {promoting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                <span>Confirm Promotion</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Student Profile Detail Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-saffron-500 text-white px-5 py-4 flex items-center justify-between border-b border-saffron-600">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-saffron-100" />
                <span>Student Profile</span>
              </h3>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-saffron-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-16 h-20 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-2xs shrink-0">
                  <img
                    src={getStudentAvatarUrl(viewingStudent)}
                    alt={viewingStudent.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 uppercase">{viewingStudent.name}</h4>
                  <p className="text-xs font-bold font-mono text-saffron-600 mt-0.5">REG: {viewingStudent.reg_no}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Program / Department</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{viewingStudent.department}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Semester / Year</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{viewingStudent.year}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                  <span className="font-bold text-slate-800 block mt-0.5 break-all">{viewingStudent.email || "N/A"}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobile No.</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{viewingStudent.mobile_no || "N/A"}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Forenoon Meal</span>
                  <span className={`font-bold block mt-0.5 ${viewingStudent.forenoon_meal !== false ? "text-emerald-700" : "text-slate-400"}`}>
                    {viewingStudent.forenoon_meal !== false ? "Eligible" : "Not Enrolled"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Afternoon Meal</span>
                  <span className={`font-bold block mt-0.5 ${viewingStudent.afternoon_meal !== false ? "text-emerald-700" : "text-slate-400"}`}>
                    {viewingStudent.afternoon_meal !== false ? "Eligible" : "Not Enrolled"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const studentToEdit = viewingStudent;
                  setViewingStudent(null);
                  handleOpenEdit(studentToEdit);
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Edit Record</span>
              </button>

              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-1.5 bg-saffron-500 hover:bg-saffron-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
