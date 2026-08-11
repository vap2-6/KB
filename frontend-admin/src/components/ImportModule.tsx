import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileUp,
  ArrowRight,
  Settings,
  CheckCircle,
  Table,
  ChevronRight,
  AlertTriangle,
  Plus,
  Check,
  CornerDownRight,
  Database,
  FileSpreadsheet,
  Shield
} from 'lucide-react';
import api from '../lib/api';
import { TableMeta, ColumnSchema, DataType } from '../types';

interface ImportModuleProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigate: (tab: string) => void;
}

export default function ImportModule({ showToast, onNavigate }: ImportModuleProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Import configuration
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [targetTable, setTargetTable] = useState('');
  const [isNewTable, setIsNewTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [duplicateOption, setDuplicateOption] = useState<'skip' | 'update' | 'insert'>('skip');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [autoSchema, setAutoSchema] = useState<ColumnSchema[]>([]);

  // Progress/Result states
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data);
      if (res.data.length > 0) {
        setTargetTable(res.data[0].name);
      }
    } catch (err) {
      showToast('Failed to fetch existing tables', 'error');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      showToast('Only standard CSV files are accepted', 'error');
      return;
    }
    setFile(selectedFile);
    setLoadingPreview(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await api.post('/import/preview', formData);
      setPreviewData(res.data);

      // Auto build column mapping: map CSV columns to themselves
      const mapping: Record<string, string> = {};
      res.data.columns.forEach((col: any) => {
        mapping[col.name] = col.name;
      });
      setColumnMapping(mapping);

      // Auto generate schema proposal for new table option
      const proposedSchema: ColumnSchema[] = res.data.columns.map((col: any) => ({
        name: col.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        type: col.type,
        primaryKey: col.name.toLowerCase() === 'id' || col.name.toLowerCase() === 'sku',
        nullable: true
      }));
      setAutoSchema(proposedSchema);

      const fileBaseName = selectedFile.name.replace('.csv', '').toLowerCase().replace(/[^a-z0-9_]/g, '');
      setNewTableName(fileBaseName);

      setStep(2);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to parse CSV preview', 'error');
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Keep auto-schema column types synchronized with auto-schema adjustments
  const handleAutoSchemaTypeChange = (idx: number, type: DataType) => {
    const updated = [...autoSchema];
    updated[idx].type = type;
    setAutoSchema(updated);
  };

  const handleAutoSchemaPkChange = (idx: number, isPk: boolean) => {
    const updated = autoSchema.map((col, i) => ({
      ...col,
      primaryKey: i === idx ? isPk : false // only allow one primary key
    }));
    setAutoSchema(updated);
  };

  const executeImport = async () => {
    if (!file) return;
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetTable', isNewTable ? newTableName : targetTable);
      formData.append('columnsMapping', JSON.stringify(columnMapping));
      formData.append('duplicateOption', duplicateOption);
      formData.append('createNewTable', String(isNewTable));

      if (isNewTable) {
        formData.append('tableSchema', JSON.stringify(autoSchema));
      }

      const res = await api.post('/import/csv', formData);
      setImportResult(res.data);
      showToast('Import completed successfully!', 'success');
      setStep(3);
      fetchTables();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Import execution failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const resetImporter = () => {
    setFile(null);
    setPreviewData(null);
    setStep(1);
    setIsNewTable(false);
    setImportResult(null);
  };

  const selectedTargetTableObj = tables.find(t => t.name === targetTable);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-10 space-y-8 transition-colors duration-300">

      {/* Import Module Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center justify-center gap-4 sm:gap-8 w-full max-w-3xl mx-auto">

          <div className="flex items-center gap-3 shrink-0">
            <span className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${step >= 1 ? 'bg-saffron-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
              1
            </span>
            <span className={`text-sm font-semibold hidden sm:inline-block ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
              Upload
            </span>
          </div>

          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />

          <div className="flex items-center gap-3 shrink-0">
            <span className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${step >= 2 ? 'bg-saffron-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
              2
            </span>
            <span className={`text-sm font-semibold hidden sm:inline-block ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
              Configure
            </span>
          </div>

          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />

          <div className="flex items-center gap-3 shrink-0">
            <span className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${step >= 3 ? 'bg-saffron-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
              3
            </span>
            <span className={`text-sm font-semibold hidden sm:inline-block ${step >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
              Summary
            </span>
          </div>

        </div>
      </div>

      {/* STEP 1: Upload and Preview */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white border-2 border-dashed rounded-3xl p-6 md:p-12 text-center shadow-sm hover:shadow transition-all relative overflow-hidden flex flex-col items-center justify-center cursor-pointer min-h-[240px] md:min-h-[300px] ${isDragOver
              ? 'border-saffron-500 bg-saffron-50/20'
              : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={loadingPreview}
            />

            {loadingPreview ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 border-3 border-saffron-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="font-semibold text-gray-800 text-sm">Processing uploaded CSV...</span>
                <span className="text-xs text-gray-400">Determining headers and inferring schema data types</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-saffron-50 border border-saffron-100 text-saffron-600 rounded-2xl mb-4">
                  <UploadCloud className="h-8 w-8 animate-bounce" />
                </div>
                <h4 className="font-bold text-gray-800 text-base">
                  Drag and drop your CSV file here
                </h4>
                <p className="text-gray-400 text-xs mt-1.5 max-w-sm leading-relaxed">
                  Support standard CSV records, automatic column parsing, type validation, and duplication management. Max 10MB limit.
                </p>
                <button className="mt-6 px-5 py-2.5 bg-saffron-500 hover:bg-saffron-600 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer">
                  Browse Local Storage
                </button>
              </div>
            )}
          </div>

          {/* Guidelines info card */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex gap-4 text-xs">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="space-y-1 text-amber-800">
              <span className="font-semibold block">Important CSV Standards</span>
              <p className="leading-relaxed opacity-90">
                To guarantee successful importing, ensure your CSV columns use uniform headers and your records do not conflict with the primary key rules of the target database table. You can map or change column headers on the next step.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* STEP 2: Configure Mapping & Target */}
      {step === 2 && previewData && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">

          <div className="space-y-6">

            {/* Target Table Selection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-4 flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-saffron-500" />
                1. Target Database Destination
              </h3>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setIsNewTable(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isNewTable
                      ? 'bg-saffron-500 text-white shadow-md shadow-saffron-500/20'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Existing Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewTable(true)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isNewTable
                      ? 'bg-saffron-500 text-white shadow-md shadow-saffron-500/20'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Create New Table
                  </button>
                </div>

                {isNewTable ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      New Table Name
                    </label>
                    <input
                      type="text"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. daily_meal_records"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Select Existing Table
                    </label>
                    <select
                      value={targetTable}
                      onChange={(e) => setTargetTable(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron-500"
                    >
                      <option value="">-- Choose target table --</option>
                      {tables.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.recordCount} rows)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Column Mapping section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-1 flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-saffron-500" />
                2. Columns Mapping & Validation
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Pair up each CSV header with its corresponding target database column.
              </p>

              <div className="overflow-x-auto -mx-6 px-6 pb-2">
                {isNewTable ? (
                  /* Auto schema definition for new tables */
                  <div className="min-w-[600px] lg:min-w-0 space-y-4">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                      <span className="col-span-2">Column (From CSV)</span>
                      <span>Data Type</span>
                      <span className="text-center">Primary Key</span>
                    </div>

                    {autoSchema.map((col, idx) => (
                      <div key={idx} className="grid grid-cols-4 items-center gap-4 py-3 border-b border-slate-50 text-xs">
                        <div className="col-span-2 flex items-center gap-2.5">
                          <CornerDownRight className="h-4 w-4 text-slate-300" />
                          <span className="font-bold text-slate-800">{col.name}</span>
                        </div>

                        <select
                          value={col.type}
                          onChange={(e) => handleAutoSchemaTypeChange(idx, e.target.value as DataType)}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-saffron-500"
                        >
                          <option value="TEXT">TEXT</option>
                          <option value="NUMBER">NUMBER</option>
                          <option value="BOOLEAN">BOOLEAN</option>
                          <option value="DATE">DATE</option>
                        </select>

                        <div className="text-center">
                          <input
                            type="checkbox"
                            checked={col.primaryKey}
                            onChange={(e) => handleAutoSchemaPkChange(idx, e.target.checked)}
                            className="rounded text-saffron-500 focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Regular Mapping */
                  <div className="min-w-[600px] lg:min-w-0 space-y-4">
                    <div className="grid grid-cols-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                      <span className="col-span-2">CSV Column Headers</span>
                      <span className="text-center col-span-1">Maps To</span>
                      <span className="col-span-2">Target Table Columns</span>
                    </div>

                    {previewData.columns.map((col: any) => (
                      <div key={col.name} className="grid grid-cols-5 items-center gap-4 py-3 border-b border-slate-50 text-xs">
                        <div className="col-span-2">
                          <span className="font-bold text-slate-800 block truncate">{col.name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 uppercase tracking-wide font-extrabold">
                            Type: {col.type}
                          </span>
                        </div>

                        <div className="flex justify-center text-slate-300">
                          <ArrowRight className="h-5 w-5" />
                        </div>

                        <div className="col-span-2">
                          <select
                            value={columnMapping[col.name] || ''}
                            onChange={(e) => {
                              setColumnMapping({
                                ...columnMapping,
                                [col.name]: e.target.value
                              });
                            }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-saffron-500"
                          >
                            <option value="">-- Ignore Column --</option>
                            {selectedTargetTableObj?.columns.map(tc => (
                              <option key={tc.name} value={tc.name}>
                                {tc.name} ({tc.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Duplicate Settings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-4 flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-saffron-500" />
                3. Duplicate Conflict Resolution
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <button
                  type="button"
                  onClick={() => setDuplicateOption('skip')}
                  className={`p-4 border rounded-2xl text-left transition-all cursor-pointer ${duplicateOption === 'skip'
                    ? 'border-saffron-500 bg-saffron-50/50 ring-1 ring-saffron-500'
                    : 'border-slate-100 hover:bg-slate-50'
                    }`}
                >
                  <span className="font-bold text-xs text-slate-800 block mb-1">
                    Skip
                  </span>
                  <span className="text-[10px] text-slate-400 leading-relaxed block">
                    Ignore CSV rows that match existing records.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateOption('update')}
                  className={`p-4 border rounded-2xl text-left transition-all cursor-pointer ${duplicateOption === 'update'
                    ? 'border-saffron-500 bg-saffron-50/50 ring-1 ring-saffron-500'
                    : 'border-slate-100 hover:bg-slate-50'
                    }`}
                >
                  <span className="font-bold text-xs text-slate-800 block mb-1">
                    Overwrite
                  </span>
                  <span className="text-[10px] text-slate-400 leading-relaxed block">
                    Update existing database records with CSV data.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateOption('insert')}
                  className={`p-4 border rounded-2xl text-left transition-all cursor-pointer ${duplicateOption === 'insert'
                    ? 'border-saffron-500 bg-saffron-50/50 ring-1 ring-saffron-500'
                    : 'border-slate-100 hover:bg-slate-50'
                    }`}
                >
                  <span className="font-bold text-xs text-slate-800 block mb-1">
                    Append
                  </span>
                  <span className="text-[10px] text-slate-400 leading-relaxed block">
                    Safely insert new items and ignore conflicts.
                  </span>
                </button>

              </div>
            </div>

          </div>

          {/* Right Sidebar: Summary & Actions */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm sticky top-8">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-6 pb-4 border-b border-slate-100">
                Source File Info
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <FileSpreadsheet className="h-4 w-4 text-saffron-500" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Rows Found</span>
                      <span className="text-slate-900 font-bold block text-sm">
                        {previewData.totalRows.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Shield className="h-4 w-4 text-saffron-500" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Columns Detected</span>
                      <span className="text-slate-900 font-bold block text-sm">
                        {previewData.columns.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Rows Preview Box */}
              <div className="mt-8">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-3 px-1">
                  Sample Data (First 5 Rows)
                </span>

                <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-inner bg-slate-50/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                          {previewData.columns.slice(0, 2).map((col: any) => (
                            <th key={col.name} className="px-3 py-2.5 font-bold uppercase tracking-tighter">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.preview.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-white transition-colors">
                            {previewData.columns.slice(0, 2).map((col: any) => (
                              <td key={col.name} className="px-3 py-2.5 text-slate-600 truncate max-w-[150px]">
                                {String(row[col.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Run Import Action */}
              <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                <button
                  type="button"
                  onClick={executeImport}
                  disabled={importing || (isNewTable && !newTableName) || (!isNewTable && !targetTable)}
                  className="w-full bg-saffron-500 hover:bg-saffron-600 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-saffron-500/20 cursor-pointer disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2.5 text-sm"
                >
                  {importing ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-5 w-5" />
                      <span>Commit to Database</span>
                    </>
                  )}
                </button>

                <button
                  onClick={resetImporter}
                  disabled={importing}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-2 font-bold transition-colors cursor-pointer"
                >
                  Discard and Choose Different File
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* STEP 3: Summary success display */}
      {step === 3 && importResult && (
        <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full inline-block mb-6 border border-emerald-100">
            <CheckCircle className="h-10 w-10 animate-scale-up" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Import Completed Successfully!
          </h2>
          <p className="text-gray-400 text-xs mt-1">
            CSV logs and records were safely committed to the SQL tables.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-8">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">
                Row Inserted
              </span>
              <span className="text-xl font-bold text-emerald-600 mt-1.5 block">
                +{importResult.summary.inserted}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">
                Row Overwritten
              </span>
              <span className="text-xl font-bold text-blue-600 mt-1.5 block">
                {importResult.summary.updated}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">
                Row Skipped
              </span>
              <span className="text-xl font-bold text-amber-500 mt-1.5 block">
                {importResult.summary.skipped}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate('database')}
              className="flex-1 bg-saffron-500 hover:bg-saffron-600 text-white font-semibold py-2.5 rounded-xl text-xs shadow-md cursor-pointer transition-all"
            >
              Browse Imported Records
            </button>
            <button
              onClick={resetImporter}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer transition-all"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
