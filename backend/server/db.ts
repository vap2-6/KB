import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { User, ImportLog, ExportLog, AuditLog, ColumnSchema, TableMeta, UserRole } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface SchemaTable {
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  createdAt: string;
}

interface DatabaseSchema {
  users: User[];
  import_logs: ImportLog[];
  export_logs: ExportLog[];
  audit_logs: AuditLog[];
  tables: Record<string, SchemaTable>;
}

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306');
const MYSQL_USER = process.env.MYSQL_USER || 'meal_app';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'Admin@RKMVC2';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'rkmvc_mealflow_db';

let pool: mysql.Pool | null = null;
let cachedDb: DatabaseSchema | null = null;

async function getPool(): Promise<mysql.Pool> {
  if (pool) return pool;

  // First connect without database to ensure DB exists
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await connection.end();

  // Now create pool with the database
  pool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return pool;
}

async function migrateMysqlSchema() {
  const p = await getPool();

  // Create meta-tables if they don't exist
  await p.query(`
    CREATE TABLE IF NOT EXISTS sys_users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE,
      passwordHash VARCHAR(255),
      role VARCHAR(50),
      createdAt VARCHAR(255)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sys_import_logs (
      id VARCHAR(50) PRIMARY KEY,
      filename VARCHAR(255),
      records_imported INT,
      status VARCHAR(50),
      created_at VARCHAR(255)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sys_export_logs (
      id VARCHAR(50) PRIMARY KEY,
      filename VARCHAR(255),
      records_exported INT,
      format VARCHAR(50),
      created_at VARCHAR(255)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sys_audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(255),
      action VARCHAR(100),
      tableName VARCHAR(255),
      details TEXT,
      createdAt VARCHAR(255)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS sys_tables (
      name VARCHAR(255) PRIMARY KEY,
      columns_json TEXT,
      created_at VARCHAR(255)
    )
  `);
}

async function loadFromMysql(): Promise<DatabaseSchema> {
  const p = await getPool();

  // 1. Load users
  const [userRows] = await p.query('SELECT * FROM sys_users');
  const users = (userRows as any[]).map(row => ({
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    createdAt: row.createdAt
  }));

  // 2. Load import logs
  const [importRows] = await p.query('SELECT * FROM sys_import_logs ORDER BY created_at DESC');
  const import_logs = (importRows as any[]).map(row => ({
    id: row.id,
    filename: row.filename,
    records_imported: row.records_imported,
    status: row.status,
    created_at: row.created_at
  }));

  // 3. Load export logs
  const [exportRows] = await p.query('SELECT * FROM sys_export_logs ORDER BY created_at DESC');
  const export_logs = (exportRows as any[]).map(row => ({
    id: row.id,
    filename: row.filename,
    records_exported: row.records_exported,
    format: row.format,
    created_at: row.created_at
  }));

  // 4. Load audit logs
  const [auditRows] = await p.query('SELECT * FROM sys_audit_logs ORDER BY createdAt DESC');
  const audit_logs = (auditRows as any[]).map(row => ({
    id: row.id,
    username: row.username,
    action: row.action,
    tableName: row.tableName,
    details: row.details,
    createdAt: row.createdAt
  }));

  // 5. Load dynamic tables meta
  const [tableMetaRows] = await p.query('SELECT * FROM sys_tables');
  const tables: Record<string, SchemaTable> = {};

  for (const metaRow of (tableMetaRows as any[])) {
    const name = metaRow.name;
    const columns = JSON.parse(metaRow.columns_json);
    const createdAt = metaRow.created_at;

    let rows: Record<string, any>[] = [];
    try {
      const [tableRows] = await p.query(`SELECT * FROM \`${name}\``);
      rows = (tableRows as any[]).map(r => {
        const rowData: Record<string, any> = {};
        columns.forEach((col: ColumnSchema) => {
          let val = r[col.name];
          if (col.type === 'BOOLEAN' && val !== null && val !== undefined) {
            rowData[col.name] = val === 1 || val === true;
          } else {
            rowData[col.name] = val;
          }
        });
        return rowData;
      });
    } catch (e) {
      console.error(`Error loading rows for physical MySQL table ${name}:`, e);
    }

    tables[name] = {
      columns,
      createdAt,
      rows
    };
  }

  return {
    users,
    import_logs,
    export_logs,
    audit_logs,
    tables
  };
}

async function saveToMysql() {
  if (!cachedDb) return;
  const p = await getPool();

  // 1. Sync sys_users
  for (const u of cachedDb.users) {
    await p.query(
      `INSERT INTO sys_users (id, username, email, passwordHash, role, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), passwordHash = VALUES(passwordHash), role = VALUES(role)`,
      [u.id, u.username, u.email, u.passwordHash, u.role, u.createdAt]
    );
  }
  const userIds = cachedDb.users.map(u => u.id);
  if (userIds.length > 0) {
    await p.query('DELETE FROM sys_users WHERE id NOT IN (?)', [userIds]);
  }

  // 2. Sync sys_import_logs
  for (const log of cachedDb.import_logs) {
    await p.query(
      `INSERT INTO sys_import_logs (id, filename, records_imported, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE filename = VALUES(filename), records_imported = VALUES(records_imported), status = VALUES(status)`,
      [log.id, log.filename, log.records_imported, log.status, log.created_at]
    );
  }
  const importLogIds = cachedDb.import_logs.map(l => l.id);
  if (importLogIds.length > 0) {
    await p.query('DELETE FROM sys_import_logs WHERE id NOT IN (?)', [importLogIds]);
  }

  // 3. Sync sys_export_logs
  for (const log of cachedDb.export_logs) {
    await p.query(
      `INSERT INTO sys_export_logs (id, filename, records_exported, format, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE filename = VALUES(filename), records_exported = VALUES(records_exported), format = VALUES(format)`,
      [log.id, log.filename, log.records_exported, log.format, log.created_at]
    );
  }
  const exportLogIds = cachedDb.export_logs.map(l => l.id);
  if (exportLogIds.length > 0) {
    await p.query('DELETE FROM sys_export_logs WHERE id NOT IN (?)', [exportLogIds]);
  }

  // 4. Sync sys_audit_logs
  for (const log of cachedDb.audit_logs) {
    await p.query(
      `INSERT INTO sys_audit_logs (id, username, action, tableName, details, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), action = VALUES(action), tableName = VALUES(tableName), details = VALUES(details)`,
      [log.id, log.username, log.action, log.tableName, log.details, log.createdAt]
    );
  }
  const auditLogIds = cachedDb.audit_logs.map(l => l.id);
  if (auditLogIds.length > 0) {
    await p.query('DELETE FROM sys_audit_logs WHERE id NOT IN (?)', [auditLogIds]);
  }

  // 5. Sync dynamic tables
  const [currentTablesRows] = await p.query('SELECT name FROM sys_tables');
  const currentTableNames = (currentTablesRows as any[]).map(row => row.name);

  const desiredTableNames = Object.keys(cachedDb.tables);

  // Drop deleted tables
  for (const oldTable of currentTableNames) {
    if (!desiredTableNames.includes(oldTable)) {
      try {
        await p.query(`DROP TABLE IF EXISTS \`${oldTable}\``);
        await p.query('DELETE FROM sys_tables WHERE name = ?', [oldTable]);
      } catch (err) {
        console.error(`Error dropping table ${oldTable} in MySQL:`, err);
      }
    }
  }

  // Create or sync existing tables
  for (const name of desiredTableNames) {
    const table = cachedDb.tables[name];

    if (!currentTableNames.includes(name)) {
      const colDefs = table.columns.map(col => {
        let colType = 'TEXT';
        if (col.type === 'NUMBER') {
          colType = 'DOUBLE';
        } else if (col.type === 'BOOLEAN') {
          colType = 'TINYINT(1)';
        } else if (col.type === 'DATE') {
          colType = 'VARCHAR(255)';
        } else if (col.primaryKey) {
          colType = 'VARCHAR(255)';
        }
        
        let def = `\`${col.name}\` ${colType}`;
        if (col.primaryKey) {
          def += ' PRIMARY KEY';
        } else if (!col.nullable) {
          def += ' NOT NULL';
        }
        return def;
      }).join(', ');

      await p.query(`CREATE TABLE IF NOT EXISTS \`${name}\` (${colDefs})`);
      await p.query(
        'INSERT INTO sys_tables (name, columns_json, created_at) VALUES (?, ?, ?)',
        [name, JSON.stringify(table.columns), table.createdAt]
      );
    }

    // Sync rows via Truncate and batch insert
    await p.query(`TRUNCATE TABLE \`${name}\``);
    
    if (table.rows.length > 0) {
      const columns = table.columns.map(c => c.name);
      const colNamesStr = columns.map(c => `\`${c}\``).join(', ');
      const placeholdersStr = columns.map(() => '?').join(', ');
      const insertQuery = `INSERT INTO \`${name}\` (${colNamesStr}) VALUES (${placeholdersStr})`;
      
      for (const row of table.rows) {
        const values = columns.map(colName => {
          const val = row[colName];
          if (val === undefined) return null;
          if (typeof val === 'boolean') return val ? 1 : 0;
          return val;
        });
        await p.query(insertQuery, values);
      }
    }
  }
}

function loadFromJson(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Error reading JSON database, resetting...', e);
    }
  }
  return createDefaultDb();
}

function saveToJsonFile() {
  if (!cachedDb) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(cachedDb, null, 2), 'utf-8');
}

let isSaving = false;
let pendingSave = false;

async function flushToDb() {
  if (isSaving) {
    pendingSave = true;
    return;
  }
  isSaving = true;
  pendingSave = false;

  try {
    const dbType = process.env.DB_TYPE || 'json';
    if (dbType === 'mysql') {
      await saveToMysql();
    } else {
      await saveToJsonFile();
    }
  } catch (err) {
    console.error('Error during DB flush:', err);
  } finally {
    isSaving = false;
    if (pendingSave) {
      flushToDb();
    }
  }
}

export async function initDb() {
  const dbType = process.env.DB_TYPE || 'json';

  if (dbType === 'mysql') {
    try {
      console.log('Connecting to local MySQL database...');
      await migrateMysqlSchema();
      cachedDb = await loadFromMysql();
      console.log('Database loaded from MySQL successfully.');
    } catch (err) {
      console.error('MySQL connection or migration failed, falling back to JSON storage:', err);
      cachedDb = loadFromJson();
    }
  } else {
    cachedDb = loadFromJson();
  }

  let changed = false;

  // Ensure default admin and user exist
  const adminExists = cachedDb.users.some(u => u.username === 'admin');
  if (!adminExists) {
    const adminPasswordHash = bcrypt.hashSync('adminpassword', 10);
    cachedDb.users.push({
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  const userExists = cachedDb.users.some(u => u.username === 'user');
  if (!userExists) {
    const userPasswordHash = bcrypt.hashSync('userpassword', 10);
    cachedDb.users.push({
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      username: 'user',
      email: 'user@example.com',
      passwordHash: userPasswordHash,
      role: 'approval_staff',
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  if (!cachedDb.tables) {
    cachedDb.tables = {};
    changed = true;
  }

  // Seed default sample tables if none exist (first run only)
  if (Object.keys(cachedDb.tables).length === 0) {
    cachedDb.tables.student_meals = {
      createdAt: new Date().toISOString(),
      columns: [
        { name: 'student_id', type: 'TEXT', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', nullable: false },
        { name: 'grade_section', type: 'TEXT', nullable: false },
        { name: 'forenoon_meal', type: 'BOOLEAN', nullable: false },
        { name: 'afternoon_meal', type: 'BOOLEAN', nullable: false },
        { name: 'last_served_date', type: 'DATE', nullable: true }
      ],
      rows: []
    };

    cachedDb.tables.meal_distribution_log = {
      createdAt: new Date().toISOString(),
      columns: [
        { name: 'log_id', type: 'TEXT', primaryKey: true, nullable: false },
        { name: 'student_id', type: 'TEXT', nullable: false },
        { name: 'session_type', type: 'TEXT', nullable: false },
        { name: 'status', type: 'TEXT', nullable: false },
        { name: 'served_by', type: 'TEXT', nullable: false },
        { name: 'timestamp', type: 'DATE', nullable: false }
      ],
      rows: []
    };
    changed = true;
  }

  if (changed) {
    if (dbType === 'mysql') {
      try {
        await saveToMysql();
      } catch (err) {
        console.error('Error seeding MySQL database:', err);
      }
    } else {
      saveToJsonFile();
    }
  }
}

function createDefaultDb(): DatabaseSchema {
  return {
    users: [],
    import_logs: [],
    export_logs: [],
    audit_logs: [],
    tables: {}
  };
}

export function getDb(): DatabaseSchema {
  if (!cachedDb) {
    cachedDb = loadFromJson();
  }
  return cachedDb;
}

export function saveDb(db: DatabaseSchema) {
  cachedDb = db;
  flushToDb();
}

export function logAudit(username: string, action: string, tableName: string, details: string) {
  const db = getDb();
  const log: AuditLog = {
    id: 'aud_' + Math.random().toString(36).substr(2, 9),
    username,
    action,
    tableName,
    details,
    createdAt: new Date().toISOString()
  };
  db.audit_logs.unshift(log);
  if (db.audit_logs.length > 200) {
    db.audit_logs = db.audit_logs.slice(0, 200);
  }
  saveDb(db);
}
