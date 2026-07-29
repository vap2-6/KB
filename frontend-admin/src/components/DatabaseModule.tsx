import React, { useState, useEffect } from 'react';
import {
  Table,
  Trash2,
  Plus,
  Edit3,
  Search,
  Play,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import api from '../lib/api';
import { TableMeta, ColumnSchema, DataType } from '../types';

interface DatabaseModuleProps {
  user: any;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function DatabaseModule({ user, showToast }: DatabaseModuleProps) {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState('');

  // Table Data States
  const [columns, setColumns] = useState<ColumnSchema[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCols, setNewTableCols] = useState<ColumnSchema[]>([
    { name: 'id', type: 'NUMBER', primaryKey: true, nullable: false }
  ]);

  const [showCrudModal, setShowCrudModal] = useState<'create' | 'edit' | null>(null);
  const [crudRecord, setCrudRecord] = useState<any>({});

  // Custom Confirmation Modal States
  const [tableToDrop, setTableToDrop] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);

  // Predefined Queries
  const [selectedQuery, setSelectedQuery] = useState('');

  const predefinedQueries = [
    { id: 'all_students', label: 'All Registered Students', table: 'student_meals', desc: 'List all students currently enrolled in the RKMVC hostel dining plan' },
    { id: 'pending_forenoon', label: 'Pending Forenoon (FN) Servings', table: 'student_meals', desc: 'Show RKMVC students who are pending forenoon meal distribution' },
    { id: 'pending_afternoon', label: 'Pending Afternoon (AN) Servings', table: 'student_meals', desc: 'Show RKMVC students who are pending afternoon meal distribution' },
  ];

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setPage(1);
      fetchTableData(1);
    }
  }, [selectedTable, search, sortBy, sortOrder]);

  const fetchTables = async (selectFirst = true, forceSelectTable?: string) => {
    try {
      const res = await api.get('/tables');
      setTables(res.data);

      if (forceSelectTable !== undefined) {
        setSelectedTable(forceSelectTable);
      } else if (selectFirst && res.data.length > 0) {
        // Automatically switch selection if the currently selected table no longer exists
        const stillExists = res.data.some((t: any) => t.name === selectedTable);
        if (!selectedTable || !stillExists) {
          setSelectedTable(res.data[0].name);
        }
      } else if (res.data.length === 0) {
        setSelectedTable('');
      }
    } catch (err) {
      showToast('Failed to load database table list', 'error');
    }
  };

  const fetchTableData = async (targetPage: number) => {
    if (!selectedTable) return;
    setLoadingTable(true);
    try {
      const params: Record<string, any> = {
        page: targetPage,
        limit,
        search
      };
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }

      const res = await api.get(`/tables/${selectedTable}`, { params });
      setColumns(res.data.columns);
      setRows(res.data.rows);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
      setTotalRecords(res.data.pagination.totalRecords);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to fetch table records', 'error');
    } finally {
      setLoadingTable(false);
    }
  };

  // Predefined Safe Queries Execution
  const handleQuerySelect = (queryId: string) => {
    setSelectedQuery(queryId);
    if (!queryId) return;

    const queryObj = predefinedQueries.find(q => q.id === queryId);
    if (!queryObj) return;

    setSelectedTable(queryObj.table);
    setSearch('');

    // Auto configure parameters depending on predefined queries
    if (queryId === 'all_students') {
      setSortBy('student_id');
      setSortOrder('asc');
      setSearch('');
    } else if (queryId === 'pending_forenoon') {
      setSortBy('forenoon_meal');
      setSortOrder('asc');
      setSearch('false');
    } else if (queryId === 'pending_afternoon') {
      setSortBy('afternoon_meal');
      setSortOrder('asc');
      setSearch('false');
    }
    showToast(`Executed Predefined Query: "${queryObj.label}"`, 'success');
  };

  // Table Creation Helpers
  const handleAddColDef = () => {
    setNewTableCols([
      ...newTableCols,
      { name: '', type: 'TEXT', nullable: true }
    ]);
  };

  const handleRemoveColDef = (idx: number) => {
    setNewTableCols(newTableCols.filter((_, i) => i !== idx));
  };

  const handleColDefChange = (idx: number, field: keyof ColumnSchema, val: any) => {
    const updated = [...newTableCols];
    if (field === 'primaryKey' && val === true) {
      // Clear PK from other columns
      updated.forEach((c, i) => {
        c.primaryKey = i === idx;
        if (i === idx) c.nullable = false;
      });
    } else {
      updated[idx] = { ...updated[idx], [field]: val } as any;
    }
    setNewTableCols(updated);
  };

  const executeCreateTable = async () => {
    if (!newTableName) {
      showToast('Please enter a valid table name', 'error');
      return;
    }
    const hasPk = newTableCols.some(c => c.primaryKey);
    if (!hasPk) {
      showToast('Table must have at least one primary key', 'error');
      return;
    }

    try {
      await api.post('/tables', {
        name: newTableName,
        columns: newTableCols
      });
      showToast(`Table '${newTableName}' created successfully!`, 'success');
      setShowCreateTable(false);
      setNewTableName('');
      setNewTableCols([{ name: 'id', type: 'NUMBER', primaryKey: true, nullable: false }]);
      fetchTables();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create table', 'error');
    }
  };

  const handleConfirmDropTable = async (tableName: string) => {
    try {
      await api.post(`/drop-table`, { tableName });
      showToast(`Table '${tableName}' dropped successfully`, 'success');
      await fetchTables(true);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to drop table', 'error');
    }
  };

  // CRUD Records Helpers
  const handleOpenCrud = (mode: 'create' | 'edit', record = {}) => {
    if (mode === 'create') {
      const defaultRec: Record<string, any> = {};
      columns.forEach(col => {
        defaultRec[col.name] = col.type === 'BOOLEAN' ? false : '';
      });
      setCrudRecord(defaultRec);
    } else {
      setCrudRecord({ ...record });
    }
    setShowCrudModal(mode);
  };

  const executeCrudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pkCol = columns.find(c => c.primaryKey) || columns.find(c => ['id', 'student_id', 'registration_id', 'token_uid', 'log_id', 'user_id', 'role_name'].includes(c.name.toLowerCase())) || columns[0];
    if (!pkCol) {
      showToast('Primary key column not found for this table.', 'error');
      return;
    }

    try {
      if (showCrudModal === 'create') {
        const res = await api.post(`/tables/${selectedTable}/records`, crudRecord);
        if (res.status === 200 || res.status === 201) {
          showToast('Record added successfully!', 'success');
        }
      } else {
        const res = await api.put(`/records/${crudRecord[pkCol.name]}`, {
          targetTableName: selectedTable,
          ...crudRecord
        });
        if (res.status === 200 || res.status === 201) {
          showToast('Record updated successfully!', 'success');
        }
      }
      
      // 1. Smoothly dismiss modal popup
      setShowCrudModal(null);
      
      // 2. Silently repaint active table data in background without page reload
      await fetchTableData(page);
      await fetchTables(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to save record. Check type matching.';
      showToast(errMsg, 'error');
    }
  };

  const handleConfirmDeleteRecord = async (record: any) => {
    const pkCol = columns.find(c => c.primaryKey) || columns.find(c => ['id', 'student_id', 'registration_id', 'token_uid', 'log_id', 'user_id', 'role_name'].includes(c.name.toLowerCase())) || columns[0];
    if (!pkCol) return;
    const pkVal = record[pkCol.name];

    try {
      await api.delete(`/records/${pkVal}`, {
        params: { tableName: selectedTable }
      });
      showToast('Record deleted successfully', 'success');
      fetchTableData(page);
      fetchTables(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete record', 'error');
    }
  };

  const activeTableObj = tables.find(t => t.name === selectedTable);

  return (
    <div className="flex-1 overflow-hidden flex bg-[#FFFBF7] transition-colors duration-200">

      {/* Table Side Bar - Hidden on mobile, shown on desktop */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 hidden md:flex">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            SQL Tables
          </span>
          <button
            onClick={() => setShowCreateTable(true)}
            className="p-1.5 text-saffron-600 bg-saffron-50 hover:bg-saffron-100 rounded-lg transition-all cursor-pointer"
            title="Create New Table"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {tables.map(t => (
            <div
              key={t.name}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${selectedTable === t.name
                ? 'bg-saffron-50 text-saffron-700 border border-saffron-100/40'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              onClick={() => setSelectedTable(t.name)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Table className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="truncate">
                  <span className="block font-semibold truncate text-slate-800">{t.name}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{t.recordCount} rows</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTableToDrop(t.name);
                }}
                className="p-1.5 hover:text-rose-500 hover:bg-rose-50 text-slate-400 rounded-lg transition-all shrink-0 cursor-pointer"
                title="Drop Table"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Table Viewer area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Table Management Header Tools */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between">

          {/* Mobile-only table selector dropdown */}
          <div className="w-full md:hidden flex flex-col gap-1.5 pb-3 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Table Profile:
            </span>
            <div className="flex gap-2">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-saffron-500"
              >
                {tables.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.recordCount} rows)
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowCreateTable(true)}
                className="px-3 bg-saffron-50 border border-saffron-200 hover:bg-saffron-100 text-saffron-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                title="Create New Table"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Query select */}
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Play className="h-3.5 w-3.5 text-saffron-500" />
              Predefined Queries:
            </span>
            <select
              value={selectedQuery}
              onChange={(e) => handleQuerySelect(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">-- Click to Run Predefined Query --</option>
              {predefinedQueries.map(q => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search bar & CRUD Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search rows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500 focus:ring-1 focus:ring-saffron-500 w-full sm:w-48 text-slate-900"
              />
            </div>

            {selectedTable && (
              <button
                onClick={() => handleOpenCrud('create')}
                className="px-3.5 py-1.5 bg-saffron-500 hover:bg-saffron-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-saffron-500/10 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Record</span>
              </button>
            )}
          </div>

        </div>

        {/* Database records grid viewer */}
        <div className="flex-1 overflow-auto p-6">
          {!selectedTable ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No tables found in database. Create a new table to start.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">

              {/* Header Schema banner */}
              <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <Info className="h-4 w-4 text-saffron-500" />
                <span className="font-bold uppercase tracking-wider text-[10px]">Schema Structure: </span>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map(col => (
                    <span key={col.name} className="px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-700">
                      {col.name} <span className="text-[8px] text-slate-400 font-bold uppercase">{col.type}{col.primaryKey ? ' PK' : ''}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Grid content */}
              <div className="flex-1 overflow-auto">
                {loadingTable ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Querying records...
                  </div>
                ) : rows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No rows match current search parameters or table is empty.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-450 border-b border-slate-200 sticky top-0">
                        {columns.map(col => (
                          <th key={col.name} className="px-4 py-3.5 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                            <button
                              onClick={() => {
                                if (sortBy === col.name) {
                                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setSortBy(col.name);
                                  setSortOrder('asc');
                                }
                              }}
                              className="hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <span>{col.name}</span>
                              {sortBy === col.name && (
                                <span className="text-[8px] text-saffron-500">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                              )}
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-3.5 text-right font-bold uppercase tracking-wider text-[10px] text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {rows.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 text-slate-600">
                          {columns.map(col => (
                            <td key={col.name} className="px-4 py-3 max-w-[200px] truncate font-mono text-[11px]">
                              {col.type === 'BOOLEAN' ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${row[col.name] ? 'bg-emerald-50 text-emerald-650' : 'bg-rose-50 text-rose-650'
                                  }`}>
                                  {row[col.name] ? 'TRUE' : 'FALSE'}
                                </span>
                              ) : (
                                String(row[col.name] ?? '')
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenCrud('edit', row)}
                                className="p-1 hover:text-blue-500 text-slate-400 transition-colors cursor-pointer"
                                title="Edit Row"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setRecordToDelete(row)}
                                className="p-1 hover:text-rose-500 text-slate-400 transition-colors cursor-pointer"
                                title="Delete Row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
                <span>Total: <strong className="text-slate-700">{totalRecords}</strong> records</span>
                <div className="flex items-center gap-3">
                  <button
                    disabled={page <= 1}
                    onClick={() => fetchTableData(page - 1)}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <span>Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong></span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => fetchTableData(page + 1)}
                    className="p-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* CREATE NEW TABLE DIALOG */}
      {showCreateTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl max-w-lg w-full relative">
            <button
              onClick={() => setShowCreateTable(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
              <FolderPlus className="h-5 w-5 text-saffron-500" />
              Create Custom Table
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Establish a new relational schema. Define names, types and indexing.
            </p>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-saffron-500 font-mono text-slate-800"
                  placeholder="e.g. customer_transactions"
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Columns Schema Definition
                  </span>
                  <button
                    type="button"
                    onClick={handleAddColDef}
                    className="text-xs font-semibold text-saffron-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Column
                  </button>
                </div>

                {newTableCols.map((col, i) => (
                  <div key={i} className="flex gap-2.5 items-center">
                    <input
                      type="text"
                      required
                      value={col.name}
                      onChange={(e) => handleColDefChange(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none font-mono text-slate-800"
                      placeholder="column_name"
                    />

                    <select
                      value={col.type}
                      onChange={(e) => handleColDefChange(i, 'type', e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none text-slate-800"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="NUMBER">NUMBER</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="DATE">DATE</option>
                    </select>

                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={col.primaryKey}
                        onChange={(e) => handleColDefChange(i, 'primaryKey', e.target.checked)}
                        className="rounded text-saffron-600 focus:ring-0 cursor-pointer"
                      />
                      <span>PK</span>
                    </label>

                    {newTableCols.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColDef(i)}
                        className="text-gray-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowCreateTable(false)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeCreateTable}
                className="flex-1 py-2 bg-saffron-500 hover:bg-saffron-600 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Create Schema Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRUD ADD/EDIT RECORD DIALOG */}
      {showCrudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl max-w-md w-full relative">
            <button
              onClick={() => setShowCrudModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
              <Table className="h-5 w-5 text-saffron-500" />
              {showCrudModal === 'create' ? 'Add Table Record' : 'Edit Table Record'}
            </h3>

            <form onSubmit={executeCrudSubmit} className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {columns.map(col => {
                const isPk = col.primaryKey;
                const isDisabled = isPk && showCrudModal === 'edit';

                return (
                  <div key={col.name}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span>{col.name}</span>
                      <span className="text-[9px] text-slate-350 font-normal">( {col.type} )</span>
                      {isPk && <span className="text-[8px] text-saffron-600 font-bold uppercase">(Primary Key)</span>}
                    </label>

                    {col.type === 'BOOLEAN' ? (
                      <select
                        required={!col.nullable}
                        value={String(crudRecord[col.name] ?? '')}
                        onChange={(e) => setCrudRecord({
                          ...crudRecord,
                          [col.name]: e.target.value === 'true'
                        })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none text-slate-800"
                      >
                        <option value="true">TRUE</option>
                        <option value="false">FALSE</option>
                      </select>
                    ) : col.type === 'DATE' ? (
                      <input
                        type="date"
                        required={!col.nullable}
                        disabled={isDisabled}
                        value={crudRecord[col.name] || ''}
                        onChange={(e) => setCrudRecord({
                          ...crudRecord,
                          [col.name]: e.target.value
                        })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none text-slate-800 disabled:opacity-50"
                      />
                    ) : (
                      <input
                        type={col.type === 'NUMBER' ? 'number' : 'text'}
                        step={col.type === 'NUMBER' ? 'any' : undefined}
                        required={!col.nullable}
                        disabled={isDisabled}
                        placeholder={isPk && col.type === 'NUMBER' ? 'Auto-incremented if empty' : `Enter value`}
                        value={crudRecord[col.name] ?? ''}
                        onChange={(e) => setCrudRecord({
                          ...crudRecord,
                          [col.name]: col.type === 'NUMBER' && e.target.value !== '' ? Number(e.target.value) : e.target.value
                        })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none text-slate-800 disabled:opacity-50"
                      />
                    )}
                  </div>
                );
              })}

              <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCrudModal(null)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-saffron-500 hover:bg-saffron-600 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  Commit Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DROP TABLE CONFIRMATION DIALOG */}
      {tableToDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative animate-scale-up">
            <button
              onClick={() => setTableToDrop(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Drop Table "{tableToDrop}"?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Are you absolutely sure you want to drop this table? All records and data will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setTableToDrop(null)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = tableToDrop;
                  setTableToDrop(null);
                  handleConfirmDropTable(target);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all"
              >
                Drop Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE RECORD CONFIRMATION DIALOG */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative animate-scale-up">
            <button
              onClick={() => setRecordToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Delete Table Record?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Are you sure you want to delete this record?
                {columns.find(c => c.primaryKey) && (
                  <span className="block font-mono text-[11px] text-slate-750 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                    {columns.find(c => c.primaryKey)!.name}: {String(recordToDelete[columns.find(c => c.primaryKey)!.name] ?? '')}
                  </span>
                )}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = recordToDelete;
                  setRecordToDelete(null);
                  handleConfirmDeleteRecord(target);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
