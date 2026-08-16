import { useState, useEffect } from 'react';
import { FileUp, FileDown, ShieldCheck, Clock, RefreshCw, Search } from 'lucide-react';
import api from '../lib/api';
import { ImportLog, ExportLog, AuditLog } from '../types';

interface LogsModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function LogsModule({ showToast }: LogsModuleProps) {
  const [activeTab, setActiveTab] = useState<'imports' | 'exports' | 'audit'>('imports');
  const [imports, setImports] = useState<ImportLog[]>([]);
  const [exports, setExports] = useState<ExportLog[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'imports') {
        const res = await api.get('/logs/imports');
        setImports(res.data);
      } else if (activeTab === 'exports') {
        const res = await api.get('/logs/exports');
        setExports(res.data);
      } else {
        const res = await api.get('/logs/audit');
        setAudits(res.data);
      }
    } catch (err) {
      showToast('Failed to load system activity logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const filteredImports = imports.filter(log =>
    log.filename.toLowerCase().includes(search.toLowerCase()) ||
    log.status.toLowerCase().includes(search.toLowerCase())
  );

  const filteredExports = exports.filter(log =>
    log.filename.toLowerCase().includes(search.toLowerCase()) ||
    log.format.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAudits = audits.filter(log =>
    log.username.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.details.toLowerCase().includes(search.toLowerCase()) ||
    log.tableName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFFBF7] p-8 space-y-8 transition-colors duration-300">

      {/* Tab select bar */}
      <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-center justify-between">
        <div className="flex bg-white border border-gray-150 p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => { setActiveTab('imports'); setSearch(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'imports'
              ? 'bg-saffron-500 text-white shadow-lg shadow-saffron-500/15'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <FileUp className="h-4 w-4" />
            <span>CSV Imports</span>
          </button>

          <button
            onClick={() => { setActiveTab('exports'); setSearch(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'exports'
              ? 'bg-saffron-500 text-white shadow-lg shadow-saffron-500/15'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <FileDown className="h-4 w-4" />
            <span>Database Exports</span>
          </button>

          <button
            onClick={() => { setActiveTab('audit'); setSearch(''); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'audit'
              ? 'bg-saffron-500 text-white shadow-lg shadow-saffron-500/15'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Security Audits</span>
          </button>
        </div>

        {/* Toolbar search & refresh */}
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search active log entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none w-full sm:w-60 text-gray-950"
            />
          </div>

          <button
            onClick={fetchLogs}
            className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-400 rounded-xl transition-colors cursor-pointer"
            title="Refresh Logs List"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="max-w-6xl mx-auto bg-white border border-gray-150 rounded-2xl p-6 shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-xs text-gray-400">
            Fetching system records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'imports' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] pb-3">
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Source Filename</th>
                    <th className="py-3 px-4">Total Records</th>
                    <th className="py-3 px-4">Trigger Timestamp</th>
                    <th className="py-3 px-4 text-right">Commit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredImports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">No import records recorded.</td>
                    </tr>
                  ) : (
                    filteredImports.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50/40 text-gray-600">
                        <td className="py-3.5 px-4 font-mono font-semibold text-gray-400">{log.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800">{log.filename}</td>
                        <td className="py-3.5 px-4 font-mono">{log.records_imported.toLocaleString()} Rows</td>
                        <td className="py-3.5 px-4 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-600'
                            : log.status === 'PARTIAL'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-rose-50 text-rose-600'
                            }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'exports' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] pb-3">
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Target Filename</th>
                    <th className="py-3 px-4">Total Records</th>
                    <th className="py-3 px-4">Export Timestamp</th>
                    <th className="py-3 px-4 text-right">Format</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredExports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">No export records recorded.</td>
                    </tr>
                  ) : (
                    filteredExports.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50/40 text-gray-600">
                        <td className="py-3.5 px-4 font-mono font-semibold text-gray-400">{log.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800">{log.filename}</td>
                        <td className="py-3.5 px-4 font-mono">{log.records_exported.toLocaleString()} Rows</td>
                        <td className="py-3.5 px-4 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-saffron-50 text-saffron-700 border border-saffron-100 uppercase tracking-wide">
                            {log.format}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'audit' && (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] pb-3">
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Table</th>
                    <th className="py-3 px-4">Audit Details</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAudits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">No audit records recorded.</td>
                    </tr>
                  ) : (
                    filteredAudits.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50/40 text-gray-600">
                        <td className="py-3.5 px-4 font-mono font-semibold text-gray-400">{log.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800">@{log.username}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-1.5 py-0.5 font-mono text-[10px] bg-gray-50 border border-gray-100 rounded text-gray-500">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-saffron-600">{log.tableName}</td>
                        <td className="py-3.5 px-4 italic max-w-sm truncate text-gray-500">{log.details}</td>
                        <td className="py-3.5 px-4 text-right text-gray-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
