import Papa from 'papaparse';
import { DataType, ColumnSchema } from '../src/types';

export function inferType(val: any): DataType {
  if (val === null || val === undefined || val === '') return 'TEXT';
  
  // Boolean check
  const str = String(val).trim().toLowerCase();
  if (str === 'true' || str === 'false') {
    return 'BOOLEAN';
  }
  
  // Number check
  if (!isNaN(Number(str)) && str !== '') {
    return 'NUMBER';
  }
  
  // Date check
  // Matches YYYY-MM-DD, YYYY/MM/DD, MM-DD-YYYY, or ISO strings
  const dateRegex = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (dateRegex.test(str)) {
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return 'DATE';
  }
  }
  
  return 'TEXT';
}

export interface CsvPreviewResult {
  columns: { name: string; type: DataType }[];
  preview: any[];
  totalRows: number;
}

export function previewCsv(csvContent: string): CsvPreviewResult {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  
  const rows = result.data as Record<string, any>[];
  if (rows.length === 0) {
    return { columns: [], preview: [], totalRows: 0 };
  }
  
  // Inferred columns from first few rows
  const headers = Object.keys(rows[0]);
  const columns = headers.map(header => {
    // Collect types from first 5 rows to infer majority
    const types: Record<DataType, number> = { TEXT: 0, NUMBER: 0, BOOLEAN: 0, DATE: 0 };
    const sampleRows = rows.slice(0, 5);
    sampleRows.forEach(row => {
      const val = row[header];
      const type = inferType(val);
      types[type] = (types[type] || 0) + 1;
    });
    
    // Find key with max votes
    let inferred: DataType = 'TEXT';
    let maxVotes = -1;
    (Object.keys(types) as DataType[]).forEach(type => {
      if (types[type] > maxVotes) {
        maxVotes = types[type];
        inferred = type;
      }
    });
    
    return { name: header, type: inferred };
  });
  
  return {
    columns,
    preview: rows.slice(0, 5),
    totalRows: rows.length
  };
}

export function coerceValue(val: any, targetType: DataType): any {
  if (val === null || val === undefined || val === '') return null;
  
  const str = String(val).trim();
  
  switch (targetType) {
    case 'NUMBER': {
      const num = Number(str);
      return isNaN(num) ? null : num;
    }
    case 'BOOLEAN': {
      const l = str.toLowerCase();
      if (l === 'true' || l === '1' || l === 'yes') return true;
      if (l === 'false' || l === '0' || l === 'no') return false;
      return !!val;
    }
    case 'DATE': {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split('T')[0];
      }
      return str;
    }
    case 'TEXT':
    default:
      return String(val);
  }
}
