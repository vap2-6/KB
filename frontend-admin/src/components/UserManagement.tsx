import React, { useState, useEffect } from 'react';

import {
  UserPlus,
  Shield,
  ScanLine,
  ChefHat,
  Mail,
  Lock,
  User,
  Check,
  Users2
} from 'lucide-react';
import api from '../lib/api';

interface UserManagementProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  currentUser: any;
}

type StaffRole = 'admin' | 'approval_staff' | 'canteen_staff';

const ROLE_META: Record<StaffRole, { label: string; description: string; icon: any; color: string }> = {
  admin: {
    label: 'Admin',
    description: 'Full access to the admin portal, including creating other Staff & Admin accounts',
    icon: Shield,
    color: 'saffron'
  },
  approval_staff: {
    label: 'Approval Staff',
    description: 'Reviews and approves student registration requests',
    icon: ScanLine,
    color: 'blue'
  },
  canteen_staff: {
    label: 'Canteen Staff',
    description: 'Scans and verifies meal tokens at the canteen counter',
    icon: ChefHat,
    color: 'emerald'
  }
};

export default function UserManagement({ showToast, currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
    role: 'approval_staff' as StaffRole
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data?.users || []);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      showToast('Please fill out username, email, and password.', 'error');
      return;
    }
    if (form.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setCreating(true);
    try {
      await api.post('/auth/register', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        display_name: form.display_name.trim() || form.username.trim(),
        role: form.role
      });
      showToast(`${ROLE_META[form.role].label} account "${form.username}" created successfully!`, 'success');
      setForm({ username: '', email: '', password: '', display_name: '', role: 'approval_staff' });
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-6 sm:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-saffron-100 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="h-6 w-6 text-saffron-500" />
            Staff & Admin Accounts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create and manage Approval Staff, Canteen Staff, and Admin accounts. Student accounts are not created here — they come through the registration flow.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-md shadow-saffron-500/20 cursor-pointer transition-all shrink-0 active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          New Staff / Admin
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-saffron-200 rounded-2xl p-6 shadow-md space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <UserPlus className="h-4.5 w-4.5 text-saffron-500" />
              Provision New Account
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
            >
              Cancel
            </button>
          </div>

          {/* Role selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Account Type *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(ROLE_META) as StaffRole[]).map((r) => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                const isSelected = form.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`text-left p-3.5 border rounded-2xl transition-all cursor-pointer ${isSelected
                      ? 'border-saffron-500 bg-saffron-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-saffron-100 text-saffron-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-saffron-600" />}
                    </div>
                    <span className="font-bold text-xs text-slate-900 block">{meta.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">{meta.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Username *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. jsen_staff"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full pl-9 pr-4 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                  maxLength={50}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Joyeeta Sen"
                value={form.display_name}
                onChange={e => setForm({ ...form, display_name: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="e.g. jsen@rkmvc.ac.in"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-9 pr-4 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                  maxLength={100}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Temporary Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-9 pr-4 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={creating}
              className="bg-saffron-500 hover:bg-saffron-600 text-white font-semibold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              {creating ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create {ROLE_META[form.role].label} Account</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Existing Users List */}
      <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Users2 className="h-4.5 w-4.5 text-saffron-500" />
            Existing Staff & Admin Accounts
          </h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading accounts...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No staff or admin accounts found yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
            {users.map((u) => {
              const meta = ROLE_META[u.role as StaffRole] || ROLE_META.approval_staff;
              const Icon = meta.icon;
              const isSelf = u.username === currentUser?.username;
              return (
                <div key={u.id} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${meta.color === 'saffron' ? 'bg-saffron-50 text-saffron-600 border-saffron-100' :
                      meta.color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{u.display_name || u.username}</span>
                        {isSelf && (
                          <span className="text-[9px] font-bold text-saffron-600 bg-saffron-50 border border-saffron-200 px-1.5 py-0.5 rounded-md">YOU</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-medium">
                        <span className="font-mono">@{u.username}</span>
                        <span>•</span>
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${meta.color === 'saffron' ? 'bg-saffron-50 text-saffron-700 border-saffron-200' :
                    meta.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
