const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Database {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Get user data directory
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'saji_enter.db');
            
            // Ensure directory exists
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }

            // Connect to database
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    throw err;
                }
                console.log('Connected to SQLite database at:', dbPath);
            });

            // Enable foreign keys
            await this.run('PRAGMA foreign_keys = ON');
            
            // Create tables from schema
            await this.createTables();
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async createTables() {
        try {
            // Try multiple possible paths for schema.sql
            let schemaPath = path.join(__dirname, 'schema.sql');
            let schema;
            
            try {
                schema = fs.readFileSync(schemaPath, 'utf8');
            } catch (error) {
                // Try alternative path for packaged app
                schemaPath = path.join(__dirname, '../../database/schema.sql');
                try {
                    schema = fs.readFileSync(schemaPath, 'utf8');
                } catch (error2) {
                    // Try resource path
                    schemaPath = path.join(process.resourcesPath, 'database', 'schema.sql');
                    schema = fs.readFileSync(schemaPath, 'utf8');
                }
            }
            
            console.log('Loading schema from:', schemaPath);
            
            // Split by semicolon and execute each statement
            const statements = schema.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                await this.run(statement);
            }
            
            // Run migrations after initial table creation
            await this.runMigrations();
            
            console.log('Database tables created successfully');
        } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
        }
    }

    async runMigrations() {
        try {
            // Check if return_quantity column exists in sales_invoice_items
            const tableInfo = await this.all(`PRAGMA table_info(sales_invoice_items)`);
            const hasReturnQuantity = tableInfo.some(column => column.name === 'return_quantity');
            
            if (!hasReturnQuantity) {
                console.log('Adding return_quantity column to sales_invoice_items...');
                await this.run(`
                    ALTER TABLE sales_invoice_items 
                    ADD COLUMN return_quantity DECIMAL(10,3) DEFAULT 0
                `);
                console.log('✅ Added return_quantity column successfully');
            }

            // Check if payment_details table exists
            const tables = await this.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='payment_details'`);
            const hasPaymentDetails = tables.length > 0;
            
            if (!hasPaymentDetails) {
                console.log('Creating payment_details table...');
                await this.run(`
                    CREATE TABLE payment_details (
                        detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        payment_id INTEGER NOT NULL,
                        invoice_id INTEGER NOT NULL,
                        amount DECIMAL(15,2) NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
                        FOREIGN KEY (invoice_id) REFERENCES sales_invoices(invoice_id) ON DELETE CASCADE
                    )
                `);
                console.log('✅ Created payment_details table successfully');
            }

            // Check if suppliers table exists
            const supplierTables = await this.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`);
            const hasSuppliers = supplierTables.length > 0;
            
            if (!hasSuppliers) {
                console.log('Creating suppliers table...');
                await this.run(`
                    CREATE TABLE suppliers (
                        supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(255) NOT NULL,
                        phone VARCHAR(20),
                        address TEXT,
                        opening_balance DECIMAL(15,2) DEFAULT 0,
                        current_balance DECIMAL(15,2) DEFAULT 0,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ Created suppliers table successfully');
            }

            // Check if expense_categories table exists
            const categoryTables = await this.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='expense_categories'`);
            const hasCategories = categoryTables.length > 0;
            
            if (!hasCategories) {
                console.log('Creating expense_categories table...');
                await this.run(`
                    CREATE TABLE expense_categories (
                        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_name TEXT UNIQUE NOT NULL,
                        description TEXT,
                        is_active BOOLEAN DEFAULT 1,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Insert default categories
                const defaultCategories = [
                    ['Office Rent', 'Monthly office rental expenses'],
                    ['Utilities', 'Electricity, water, internet bills'],
                    ['Office Supplies', 'Stationery, printer supplies, etc.'],
                    ['Transportation', 'Travel and transportation costs'],
                    ['Meals & Entertainment', 'Business meals and entertainment'],
                    ['Marketing', 'Advertising and marketing expenses'],
                    ['Insurance', 'Business insurance premiums'],
                    ['Legal & Professional', 'Legal and professional service fees'],
                    ['Repairs & Maintenance', 'Equipment and facility maintenance'],
                    ['Software & Subscriptions', 'Software licenses and subscriptions'],
                    ['Staff Salaries', 'Employee salaries and wages'],
                    ['Travel', 'Business travel expenses'],
                    ['Bank Charges', 'Banking fees and charges'],
                    ['Other', 'Miscellaneous expenses']
                ];

                for (const [name, description] of defaultCategories) {
                    await this.run(
                        'INSERT OR IGNORE INTO expense_categories (category_name, description) VALUES (?, ?)',
                        [name, description]
                    );
                }

                console.log('✅ Created expense_categories table with default categories');
            }

            // Check if expenses table needs migration for category_id
            const expenseInfo = await this.all(`PRAGMA table_info(expenses)`);
            const hasCategoryId = expenseInfo.some(column => column.name === 'category_id');
            const hasNotes = expenseInfo.some(column => column.name === 'notes');
            
            if (!hasCategoryId || !hasNotes) {
                console.log('Migrating expenses table to use category_id and notes...');
                
                // Create new expenses table with correct structure
                await this.run(`
                    CREATE TABLE expenses_new (
                        expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        expense_number TEXT UNIQUE NOT NULL,
                        expense_date DATE NOT NULL,
                        category_id INTEGER NOT NULL,
                        description TEXT NOT NULL,
                        amount DECIMAL(15,2) NOT NULL,
                        account_id INTEGER NOT NULL,
                        payment_mode TEXT CHECK(payment_mode IN ('cash', 'cheque', 'online', 'card')) DEFAULT 'cash',
                        bill_number TEXT,
                        vendor_name TEXT,
                        notes TEXT,
                        is_recurring BOOLEAN DEFAULT 0,
                        is_cancelled BOOLEAN DEFAULT 0,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES accounts(account_id),
                        FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
                    )
                `);

                // Migrate existing data
                const existingExpenses = await this.all('SELECT * FROM expenses WHERE is_deleted = 0');
                
                for (const expense of existingExpenses) {
                    // Find matching category or use 'Other'
                    let categoryId = 14; // Default to 'Other' category
                    const category = await this.get(
                        'SELECT category_id FROM expense_categories WHERE category_name = ?',
                        [expense.category]
                    );
                    if (category) {
                        categoryId = category.category_id;
                    }

                    await this.run(`
                        INSERT INTO expenses_new (
                            expense_id, expense_number, expense_date, category_id, description, 
                            amount, account_id, payment_mode, bill_number, vendor_name, notes,
                            is_recurring, is_cancelled, is_deleted, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        expense.expense_id, expense.expense_number, expense.expense_date,
                        categoryId, expense.description, expense.amount, expense.account_id,
                        expense.payment_mode, expense.bill_number, expense.vendor_name, null,
                        expense.is_recurring, expense.is_cancelled, expense.is_deleted,
                        expense.created_at, expense.updated_at
                    ]);
                }

                // Replace old table
                await this.run('DROP TABLE expenses');
                await this.run('ALTER TABLE expenses_new RENAME TO expenses');
                
                console.log('✅ Migrated expenses table successfully');
            }

            // Fix account_id constraints in payments and expenses tables
            await this.fixAccountIdConstraints();
            
        } catch (error) {
            console.error('Error running migrations:', error);
            // Don't throw error for migrations - log and continue
        }
    }

    async fixAccountIdConstraints() {
        try {
            console.log('Checking and fixing account_id constraints...');

            // Check if payments table has NOT NULL constraint on account_id
            const paymentsInfo = await this.all(`PRAGMA table_info(payments)`);
            const accountIdColumn = paymentsInfo.find(col => col.name === 'account_id');
            
            if (accountIdColumn && accountIdColumn.notnull === 1) {
                console.log('Fixing payments table account_id constraint...');
                
                // Create new payments table without NOT NULL constraint
                await this.run(`DROP TABLE IF EXISTS payments_new`);
                await this.run(`
                    CREATE TABLE payments_new (
                        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        payment_type TEXT CHECK(payment_type IN ('payment_in', 'payment_out')) NOT NULL,
                        payment_number TEXT UNIQUE NOT NULL,
                        payment_date DATE NOT NULL,
                        party_id INTEGER NOT NULL,
                        account_id INTEGER,
                        amount DECIMAL(15,2) NOT NULL,
                        payment_mode TEXT CHECK(payment_mode IN ('cash', 'cheque', 'online', 'card')) DEFAULT 'cash',
                        cheque_number TEXT,
                        cheque_date DATE,
                        bank_ref TEXT,
                        notes TEXT,
                        is_cancelled BOOLEAN DEFAULT 0,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (party_id) REFERENCES parties(party_id),
                        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
                    )
                `);

                // Copy existing data with explicit column mapping
                await this.run(`
                    INSERT INTO payments_new (
                        payment_id, payment_type, payment_number, payment_date, party_id, account_id, 
                        amount, payment_mode, cheque_number, cheque_date, bank_ref, notes, 
                        is_cancelled, is_deleted, created_at, updated_at
                    ) SELECT 
                        payment_id, payment_type, payment_number, payment_date, party_id, account_id, 
                        amount, payment_mode, cheque_number, cheque_date, bank_ref, notes, 
                        is_cancelled, is_deleted, created_at, updated_at
                    FROM payments
                `);

                // Replace old table
                await this.run('DROP TABLE payments');
                await this.run('ALTER TABLE payments_new RENAME TO payments');
                
                console.log('✅ Fixed payments table account_id constraint');
            }

            // Check if expenses table has NOT NULL constraint on account_id  
            const expensesInfo = await this.all(`PRAGMA table_info(expenses)`);
            const expenseAccountCol = expensesInfo.find(col => col.name === 'account_id');
            
            if (expenseAccountCol && expenseAccountCol.notnull === 1) {
                console.log('Fixing expenses table account_id constraint...');
                
                // Create new expenses table without NOT NULL constraint
                await this.run(`
                    CREATE TABLE expenses_temp (
                        expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        expense_number TEXT UNIQUE NOT NULL,
                        expense_date DATE NOT NULL,
                        category_id INTEGER NOT NULL,
                        description TEXT NOT NULL,
                        amount DECIMAL(15,2) NOT NULL,
                        account_id INTEGER,
                        payment_mode TEXT CHECK(payment_mode IN ('cash', 'cheque', 'online', 'card')) DEFAULT 'cash',
                        bill_number TEXT,
                        vendor_name TEXT,
                        notes TEXT,
                        is_recurring BOOLEAN DEFAULT 0,
                        is_cancelled BOOLEAN DEFAULT 0,
                        is_deleted BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (account_id) REFERENCES accounts(account_id),
                        FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
                    )
                `);

                // Copy existing data
                await this.run(`
                    INSERT INTO expenses_temp SELECT * FROM expenses
                `);

                // Replace old table
                await this.run('DROP TABLE expenses');
                await this.run('ALTER TABLE expenses_temp RENAME TO expenses');
                
                console.log('✅ Fixed expenses table account_id constraint');
            }

        } catch (error) {
            console.error('Error fixing account_id constraints:', error);
            // Don't throw - just log and continue
        }
    }

    // Promise wrapper for database run method
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Promise wrapper for database get method
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Promise wrapper for database all method
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Transaction wrapper
    async transaction(callback) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.run('BEGIN TRANSACTION');
                const result = await callback();
                await this.run('COMMIT');
                resolve(result);
            } catch (error) {
                await this.run('ROLLBACK');
                reject(error);
            }
        });
    }

    // Get next sequence number
    async getNextSequence(sequenceName) {
        try {
            const sequence = await this.get(
                'SELECT * FROM sequences WHERE sequence_name = ?',
                [sequenceName]
            );
            
            if (!sequence) {
                throw new Error(`Sequence ${sequenceName} not found`);
            }

            const nextValue = sequence.current_value + 1;
            
            // Update sequence
            await this.run(
                'UPDATE sequences SET current_value = ? WHERE sequence_name = ?',
                [nextValue, sequenceName]
            );

            // Format number
            const paddedNumber = nextValue.toString().padStart(sequence.format_length, '0');
            return `${sequence.prefix}${paddedNumber}${sequence.suffix}`;
            
        } catch (error) {
            console.error('Error getting next sequence:', error);
            throw error;
        }
    }

    // Backup database
    async backup(backupPath) {
        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            
            backup.step(-1, (err) => {
                if (err) {
                    reject(err);
                } else {
                    backup.finish((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(true);
                        }
                    });
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Health check
    async healthCheck() {
        try {
            await this.get('SELECT 1');
            return true;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const database = new Database();

module.exports = database;