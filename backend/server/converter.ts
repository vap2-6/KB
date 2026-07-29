import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function csvToJson(csvContent: string): any[] {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  return result.data;
}

export function jsonToCsv(jsonContent: any[]): string {
  return Papa.unparse(jsonContent);
}

export function csvToExcelBuffer(csvContent: string, sheetName = 'Sheet1'): Buffer {
  const json = csvToJson(csvContent);
  const worksheet = XLSX.utils.json_to_sheet(json);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export function excelToCsv(excelBuffer: Buffer): string {
  const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert worksheet to JSON or CSV directly
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return csv;
}

export function jsonToExcelBuffer(jsonContent: any[], sheetName = 'Sheet1'): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(jsonContent);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export function excelToJson(excelBuffer: Buffer): any[] {
  const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  return XLSX.utils.sheet_to_json(worksheet);
}

// Generate SQL INSERT statements
export function jsonToSqlInserts(tableName: string, data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  const colNames = columns.map(c => `\`${c}\``).join(', ');
  
  const statements = data.map(row => {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? '1' : '0';
      // Escape strings
      const escaped = String(val).replace(/'/g, "''");
      return `'${escaped}'`;
    }).join(', ');
    
    return `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${values});`;
  });
  
  return statements.join('\n');
}
