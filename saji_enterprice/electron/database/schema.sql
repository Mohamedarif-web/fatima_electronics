-- Saji Enterprises Database Schema
-- SQLite Database for Local Business Management

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    logo_path TEXT,
    financial_year_start DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Item Master
CREATE TABLE IF NOT EXISTS items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    item_code TEXT UNIQUE,
    barcode TEXT,
    hsn_code TEXT,
    unit TEXT DEFAULT 'PCS',
    sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    sale_price_type TEXT CHECK(sale_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax',
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    purchase_price_type TEXT CHECK(purchase_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax',
    gst_rate DECIMAL(5,2) DEFAULT 0,
    opening_stock DECIMAL(10,3) DEFAULT 0,
    current_stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Party Master (Customers/Suppliers)
CREATE TABLE IF NOT EXISTS parties (
    party_id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_type TEXT CHECK(party_type IN ('customer', 'supplier', 'both')) NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    balance_type TEXT CHECK(balance_type IN ('debit', 'credit')) DEFAULT 'debit',
    current_balance DECIMAL(15,2) DEFAULT 0,
    min_due_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bank and Cash Accounts
CREATE TABLE IF NOT EXISTS accounts (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL,
    account_type TEXT CHECK(account_type IN ('cash', 'bank')) NOT NULL,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
    invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    party_id INTEGER NOT NULL,
    payment_type TEXT CHECK(payment_type IN ('cash', 'credit')) NOT NULL,
    account_id INTEGER,
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES parties(party_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Sales Invoice Items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    taxable_amount DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    return_quantity DECIMAL(10,3) DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL,
    bill_date DATE NOT NULL,
    supplier_id INTEGER NOT NULL,
    payment_type TEXT CHECK(payment_type IN ('cash', 'credit')) NOT NULL,
    account_id INTEGER,
    subtotal DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES parties(party_id),
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Purchase Invoice Items
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    taxable_amount DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(purchase_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- Payments (In/Out)
CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_type TEXT CHECK(payment_type IN ('payment_in', 'payment_out')) NOT NULL,
    payment_number TEXT UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    party_id INTEGER NOT NULL,
    account_id INTEGER,
    amount DECIMAL(15,2) NOT NULL,
    reference_type TEXT CHECK(reference_type IN ('invoice', 'advance', 'adjustment')),
    reference_id INTEGER,
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
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default expense categories
INSERT OR IGNORE INTO expense_categories (category_name, description) VALUES 
('Office Rent', 'Monthly office rental expenses'),
('Utilities', 'Electricity, water, internet bills'),
('Office Supplies', 'Stationery, printer supplies, etc.'),
('Transportation', 'Travel and transportation costs'),
('Meals & Entertainment', 'Business meals and entertainment'),
('Marketing', 'Advertising and marketing expenses'),
('Insurance', 'Business insurance premiums'),
('Legal & Professional', 'Legal and professional service fees'),
('Repairs & Maintenance', 'Equipment and facility maintenance'),
('Software & Subscriptions', 'Software licenses and subscriptions'),
('Staff Salaries', 'Employee salaries and wages'),
('Travel', 'Business travel expenses'),
('Bank Charges', 'Banking fees and charges'),
('Other', 'Miscellaneous expenses');

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
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
);

-- General Ledger (Double Entry)
CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date DATE NOT NULL,
    transaction_type TEXT NOT NULL, -- 'sale', 'purchase', 'payment_in', 'payment_out', 'expense'
    reference_id INTEGER NOT NULL,
    reference_number TEXT NOT NULL,
    account_type TEXT NOT NULL, -- 'party', 'item', 'account', 'expense'
    account_id INTEGER,
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    movement_type TEXT CHECK(movement_type IN ('in', 'out', 'adjustment')) NOT NULL,
    reference_type TEXT NOT NULL, -- 'sale', 'purchase', 'opening', 'adjustment'
    reference_id INTEGER,
    quantity DECIMAL(10,3) NOT NULL,
    rate DECIMAL(10,2),
    movement_date DATE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- Auto-increment sequences
CREATE TABLE IF NOT EXISTS sequences (
    sequence_name TEXT PRIMARY KEY,
    current_value INTEGER DEFAULT 0,
    prefix TEXT DEFAULT '',
    suffix TEXT DEFAULT '',
    format_length INTEGER DEFAULT 4
);

-- Insert default sequences
INSERT OR IGNORE INTO sequences (sequence_name, current_value, prefix) VALUES 
('sales_invoice', 0, 'SI'),
('purchase_invoice', 0, 'PI'),
('payment_in', 0, 'RCP'),
('payment_out', 0, 'PAY'),
('expense', 0, 'EXP');

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT CHECK(role IN ('admin', 'user', 'viewer')) DEFAULT 'user',
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- No default accounts - users must create accounts via Bank/Cash management

-- Insert admin user (password: admin123 - will be hashed on first login)
INSERT OR IGNORE INTO users (username, password_hash, full_name, role) 
VALUES ('admin', 'admin123', 'Administrator', 'admin');

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_code ON items(item_code);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_date ON purchase_invoices(bill_date);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_movements(movement_date);
-- Add missing payment_transactions table to match code expectations
CREATE TABLE IF NOT EXISTS payment_transactions (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_type TEXT CHECK(payment_type IN ('payment_in', 'payment_out')) NOT NULL,
    payment_number TEXT UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    party_id INTEGER NOT NULL,
    account_id INTEGER,
    amount DECIMAL(15,2) NOT NULL,
    reference_type TEXT CHECK(reference_type IN ('invoice', 'advance', 'adjustment')),
    reference_id INTEGER,
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
);
