// Database service for frontend
class DatabaseService {
    // Execute a query that returns multiple rows
    async query(sql, params = []) {
        try {
            const result = await window.electronAPI.dbQuery(sql, params);
            return result || [];
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    // Execute a query that returns a single row
    async get(sql, params = []) {
        try {
            return await window.electronAPI.dbGet(sql, params);
        } catch (error) {
            console.error('Database get error:', error);
            throw error;
        }
    }

    // Execute a query that modifies data (INSERT, UPDATE, DELETE)
    async run(sql, params = []) {
        try {
            return await window.electronAPI.dbRun(sql, params);
        } catch (error) {
            console.error('Database run error:', error);
            throw error;
        }
    }

    // Execute multiple queries in a transaction
    async transaction(operations) {
        try {
            return await window.electronAPI.dbTransaction(operations);
        } catch (error) {
            console.error('Database transaction error:', error);
            throw error;
        }
    }

    // Get next sequence number
    async getNextSequence(sequenceName) {
        try {
            return await window.electronAPI.getNextSequence(sequenceName);
        } catch (error) {
            console.error('Get sequence error:', error);
            throw error;
        }
    }

    // ITEM MASTER METHODS
    async getItems(includeDeleted = false) {
        const whereClause = includeDeleted ? '' : 'WHERE is_deleted = 0';
        return await this.query(`
            SELECT * FROM items 
            ${whereClause}
            ORDER BY product_name
        `);
    }

    async getItemById(itemId) {
        return await this.get(
            'SELECT * FROM items WHERE item_id = ? AND is_deleted = 0',
            [itemId]
        );
    }

    async saveItem(itemData) {
        const {
            item_id,
            product_name,
            item_code,
            barcode,
            hsn_code,
            unit,
            sale_price,
            sale_price_type,
            purchase_price,
            purchase_price_type,
            gst_rate,
            opening_stock,
            current_stock,
            min_stock
        } = itemData;

        if (item_id) {
            // Update existing item
            return await this.run(`
                UPDATE items SET 
                    product_name = ?,
                    item_code = ?,
                    barcode = ?,
                    hsn_code = ?,
                    unit = ?,
                    sale_price = ?,
                    sale_price_type = ?,
                    purchase_price = ?,
                    purchase_price_type = ?,
                    gst_rate = ?,
                    current_stock = ?,
                    min_stock = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE item_id = ?
            `, [
                product_name, item_code, barcode, hsn_code, unit,
                sale_price, sale_price_type, purchase_price, purchase_price_type,
                gst_rate, current_stock, min_stock, item_id
            ]);
        } else {
            // Create new item
            const result = await this.run(`
                INSERT INTO items (
                    product_name, item_code, barcode, hsn_code, unit,
                    sale_price, sale_price_type, purchase_price, purchase_price_type,
                    gst_rate, opening_stock, current_stock, min_stock
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                product_name, item_code, barcode, hsn_code, unit,
                sale_price, sale_price_type, purchase_price, purchase_price_type,
                gst_rate, opening_stock, opening_stock, min_stock
            ]);

            // Create opening stock entry if > 0
            if (opening_stock > 0) {
                await this.run(`
                    INSERT INTO stock_movements (
                        item_id, movement_type, reference_type, quantity, 
                        rate, movement_date, description
                    ) VALUES (?, 'in', 'opening', ?, ?, date('now'), 'Opening Stock')
                `, [result.id, opening_stock, purchase_price]);
            }

            return result;
        }
    }

    async deleteItem(itemId) {
        return await this.run(
            'UPDATE items SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?',
            [itemId]
        );
    }

    // PARTY MASTER METHODS
    async getParties(partyType = null, includeDeleted = false) {
        // Real-time calculation of party outstanding balances
        let sql = `
            SELECT 
                p.*,
                p.opening_balance + 
                COALESCE(sales.total_outstanding_sales, 0) - 
                COALESCE(payments_in.total_payments_received, 0) +
                COALESCE(purchases.total_outstanding_purchases, 0) -
                COALESCE(payments_out.total_payments_made, 0) as calculated_current_balance
            FROM parties p
            LEFT JOIN (
                SELECT 
                    party_id, 
                    SUM(balance_amount) as total_outstanding_sales
                FROM sales_invoices 
                WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
                GROUP BY party_id
            ) sales ON p.party_id = sales.party_id
            LEFT JOIN (
                SELECT 
                    party_id,
                    SUM(amount) as total_payments_received
                FROM payments
                WHERE payment_type = 'payment_in' AND is_deleted = 0
                GROUP BY party_id
            ) payments_in ON p.party_id = payments_in.party_id
            LEFT JOIN (
                SELECT 
                    supplier_id as party_id,
                    SUM(balance_amount) as total_outstanding_purchases
                FROM purchase_invoices
                WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
                GROUP BY supplier_id
            ) purchases ON p.party_id = purchases.party_id
            LEFT JOIN (
                SELECT 
                    party_id,
                    SUM(amount) as total_payments_made
                FROM payments
                WHERE payment_type = 'payment_out' AND is_deleted = 0
                GROUP BY party_id
            ) payments_out ON p.party_id = payments_out.party_id
        `;
        
        const params = [];
        const conditions = [];

        if (!includeDeleted) {
            conditions.push('p.is_deleted = 0');
        }

        if (partyType) {
            conditions.push('(p.party_type = ? OR p.party_type = "both")');
            params.push(partyType);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY p.name';

        try {
            console.log('Executing party query:', sql);
            const parties = await this.query(sql, params);
            console.log('Raw parties result:', parties);
            
            // Debug: Check actual sales for each party
            for (const party of parties) {
                console.log(`Checking sales for party ${party.name} (ID: ${party.party_id})`);
                try {
                    const salesCheck = await this.query(`
                        SELECT 
                            COUNT(*) as invoice_count, 
                            SUM(total_amount) as total_sales, 
                            payment_type
                        FROM sales_invoices 
                        WHERE party_id = ? AND is_cancelled = 0 AND is_deleted = 0
                        GROUP BY payment_type
                    `, [party.party_id]);
                    console.log(`Sales breakdown for party ${party.name}:`, salesCheck);
                    
                    // Also check if any sales exist at all for this party
                    const allSales = await this.query(`
                        SELECT invoice_id, invoice_number, total_amount, payment_type 
                        FROM sales_invoices 
                        WHERE party_id = ?
                    `, [party.party_id]);
                    console.log(`All sales for party ${party.name}:`, allSales);
                    
                } catch (error) {
                    console.error(`Error checking sales for party ${party.name}:`, error);
                }
            }
            
            // Update the current_balance field with calculated value and return corrected data
            const result = parties.map(party => {
                const calculatedBalance = party.calculated_current_balance;
                console.log(`Party: ${party.name}, Opening: ${party.opening_balance}, Calculated: ${calculatedBalance}, Old Current: ${party.current_balance}`);
                return {
                    ...party,
                    current_balance: calculatedBalance !== null ? calculatedBalance : party.opening_balance || 0
                };
            });
            
            console.log('Processed parties result:', result);
            return result;
        } catch (error) {
            console.error('Error in getParties query:', error);
            // Fallback to simple query if complex query fails
            let fallbackSql = 'SELECT * FROM parties';
            const fallbackParams = [];
            const fallbackConditions = [];

            if (!includeDeleted) {
                fallbackConditions.push('is_deleted = 0');
            }

            if (partyType) {
                fallbackConditions.push('(party_type = ? OR party_type = "both")');
                fallbackParams.push(partyType);
            }

            if (fallbackConditions.length > 0) {
                fallbackSql += ' WHERE ' + fallbackConditions.join(' AND ');
            }

            fallbackSql += ' ORDER BY name';
            
            console.log('Using fallback query:', fallbackSql);
            return await this.query(fallbackSql, fallbackParams);
        }
    }

    async getPartyById(partyId) {
        return await this.get(
            'SELECT * FROM parties WHERE party_id = ? AND is_deleted = 0',
            [partyId]
        );
    }

    async saveParty(partyData) {
        const {
            party_id,
            party_type,
            name,
            address,
            phone,
            email,
            gst_number,
            opening_balance,
            balance_type,
            min_due_days
        } = partyData;

        console.log('Database saveParty called with:', partyData);
        console.log('🔍 Database saveParty - min_due_days value:', min_due_days);

        if (party_id) {
            // Update existing party
            console.log('Updating party with ID:', party_id);
            const result = await this.run(`
                UPDATE parties SET 
                    party_type = ?, name = ?, address = ?, phone = ?, email = ?,
                    gst_number = ?, opening_balance = ?, balance_type = ?, min_due_days = ?, updated_at = CURRENT_TIMESTAMP
                WHERE party_id = ?
            `, [party_type, name, address, phone, email, gst_number, opening_balance, balance_type, min_due_days, party_id]);
            
            // After updating party, recalculate and update current balance
            await this.updatePartyCurrentBalance(party_id);
            console.log('Update result:', result);
            return result;
        } else {
            // Create new party
            console.log('Creating new party');
            const result = await this.run(`
                INSERT INTO parties (
                    party_type, name, address, phone, email, gst_number,
                    opening_balance, balance_type, current_balance, min_due_days
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                party_type, name, address, phone, email, gst_number,
                opening_balance, balance_type, opening_balance, min_due_days
            ]);
            console.log('Insert result:', result);
            return result;
        }
    }

    async deleteParty(partyId) {
        return await this.run(
            'UPDATE parties SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE party_id = ?',
            [partyId]
        );
    }

    // Helper method to recalculate and update party current balance (REAL-TIME)
    async updatePartyCurrentBalance(partyId) {
        try {
            const result = await this.get(`
                SELECT 
                    p.opening_balance,
                    COALESCE(sales.total_outstanding_sales, 0) as total_outstanding_sales,
                    COALESCE(payments_in.total_payments_received, 0) as total_payments_received,
                    COALESCE(purchases.total_outstanding_purchases, 0) as total_outstanding_purchases,
                    COALESCE(payments_out.total_payments_made, 0) as total_payments_made
                FROM parties p
                LEFT JOIN (
                    SELECT 
                        party_id, 
                        SUM(balance_amount) as total_outstanding_sales
                    FROM sales_invoices 
                    WHERE party_id = ? AND is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
                ) sales ON p.party_id = sales.party_id
                LEFT JOIN (
                    SELECT 
                        party_id,
                        SUM(amount) as total_payments_received
                    FROM payments
                    WHERE party_id = ? AND payment_type = 'payment_in' AND is_deleted = 0
                ) payments_in ON p.party_id = payments_in.party_id
                LEFT JOIN (
                    SELECT 
                        supplier_id as party_id,
                        SUM(balance_amount) as total_outstanding_purchases
                    FROM purchase_invoices
                    WHERE supplier_id = ? AND is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
                ) purchases ON p.party_id = purchases.party_id
                LEFT JOIN (
                    SELECT 
                        party_id,
                        SUM(amount) as total_payments_made
                    FROM payments
                    WHERE party_id = ? AND payment_type = 'payment_out' AND is_deleted = 0
                ) payments_out ON p.party_id = payments_out.party_id
                WHERE p.party_id = ?
            `, [partyId, partyId, partyId, partyId, partyId]);

            if (result) {
                // Real-time calculation: Opening + Outstanding Sales - Payments Received + Outstanding Purchases - Payments Made
                const currentBalance = result.opening_balance + 
                                    result.total_outstanding_sales - 
                                    result.total_payments_received + 
                                    result.total_outstanding_purchases - 
                                    result.total_payments_made;

                await this.run(`
                    UPDATE parties 
                    SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE party_id = ?
                `, [currentBalance, partyId]);

                console.log(`🔄 Real-time balance updated for party ${partyId}: ₹${currentBalance.toFixed(2)}`);
                console.log(`  Opening: ₹${result.opening_balance}`);
                console.log(`  + Outstanding Sales: ₹${result.total_outstanding_sales}`);
                console.log(`  - Payments Received: ₹${result.total_payments_received}`);
                console.log(`  + Outstanding Purchases: ₹${result.total_outstanding_purchases}`);
                console.log(`  - Payments Made: ₹${result.total_payments_made}`);
                
                return currentBalance;
            }
        } catch (error) {
            console.error('Error updating party current balance:', error);
        }
    }

    // ACCOUNT METHODS
    async getAccounts(includeDeleted = false) {
        const whereClause = includeDeleted ? '' : 'WHERE is_deleted = 0';
        return await this.query(`
            SELECT * FROM accounts 
            ${whereClause}
            ORDER BY account_name
        `);
    }

    async getAccountById(accountId) {
        return await this.get(
            'SELECT * FROM accounts WHERE account_id = ? AND is_deleted = 0',
            [accountId]
        );
    }

    // PAYMENT TRANSACTION METHODS
    async createPaymentTables() {
        try {
            // Create payment_transactions table
            await this.run(`
                CREATE TABLE IF NOT EXISTS payment_transactions (
                    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reference_type TEXT NOT NULL,
                    reference_id INTEGER NOT NULL,
                    reference_number TEXT,
                    party_id INTEGER,
                    account_id INTEGER NOT NULL,
                    payment_type TEXT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    payment_date DATE NOT NULL,
                    payment_method TEXT DEFAULT 'bank_transfer',
                    description TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_deleted INTEGER DEFAULT 0,
                    FOREIGN KEY (party_id) REFERENCES parties(party_id),
                    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
                )
            `);

            // Create account_transactions table
            await this.run(`
                CREATE TABLE IF NOT EXISTS account_transactions (
                    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    reference_type TEXT,
                    reference_id INTEGER,
                    transaction_type TEXT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    balance_before DECIMAL(10,2),
                    balance_after DECIMAL(10,2),
                    transaction_date DATE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
                )
            `);

            console.log('✅ Payment tables created successfully');
            return true;
        } catch (error) {
            console.error('❌ Error creating payment tables:', error);
            return false;
        }
    }

    async recordPaymentTransaction(paymentData) {
        // Ensure payment tables exist
        await this.createPaymentTables();
        
        const {
            reference_type, reference_id, reference_number,
            party_id, account_id, payment_type, amount,
            payment_date, payment_method = 'bank_transfer',
            description, notes
        } = paymentData;

        return await this.run(`
            INSERT INTO payment_transactions (
                reference_type, reference_id, reference_number, party_id,
                account_id, payment_type, amount, payment_date,
                payment_method, description, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            reference_type, reference_id, reference_number, party_id,
            account_id, payment_type, amount, payment_date,
            payment_method, description, notes
        ]);
    }

    async recordAccountTransaction(accountData) {
        const {
            account_id, reference_type, reference_id,
            transaction_type, amount, balance_before, balance_after,
            transaction_date, description
        } = accountData;

        return await this.run(`
            INSERT INTO account_transactions (
                account_id, reference_type, reference_id, transaction_type,
                amount, balance_before, balance_after, transaction_date, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            account_id, reference_type, reference_id, transaction_type,
            amount, balance_before, balance_after, transaction_date, description
        ]);
    }

    async updateAccountBalance(accountId, amount, transactionData) {
        // Ensure payment tables exist
        await this.createPaymentTables();
        
        // Get current balance
        const account = await this.get('SELECT current_balance FROM accounts WHERE account_id = ?', [accountId]);
        const balanceBefore = account ? account.current_balance : 0;
        const balanceAfter = balanceBefore + amount;

        // Update account balance
        await this.run(`
            UPDATE accounts 
            SET current_balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE account_id = ?
        `, [balanceAfter, accountId]);

        // Record transaction history
        if (transactionData) {
            await this.recordAccountTransaction({
                ...transactionData,
                account_id: accountId,
                amount: Math.abs(amount),
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                transaction_type: amount > 0 ? 'credit' : 'debit'
            });
        }

        return { balanceBefore, balanceAfter };
    }

    async getPaymentHistory(filters = {}) {
        let sql = `
            SELECT 
                pt.*,
                p.name as party_name,
                a.account_name,
                CASE 
                    WHEN pt.reference_type = 'sales_invoice' THEN 'Sales'
                    WHEN pt.reference_type = 'purchase_invoice' THEN 'Purchase'
                    WHEN pt.reference_type = 'expense' THEN 'Expense'
                    ELSE pt.reference_type
                END as transaction_category
            FROM payment_transactions pt
            LEFT JOIN parties p ON pt.party_id = p.party_id
            LEFT JOIN accounts a ON pt.account_id = a.account_id
            WHERE pt.is_deleted = 0
        `;
        const params = [];

        if (filters.account_id) {
            sql += ' AND pt.account_id = ?';
            params.push(filters.account_id);
        }

        if (filters.reference_type) {
            sql += ' AND pt.reference_type = ?';
            params.push(filters.reference_type);
        }

        if (filters.date_from) {
            sql += ' AND pt.payment_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            sql += ' AND pt.payment_date <= ?';
            params.push(filters.date_to);
        }

        sql += ' ORDER BY pt.payment_date DESC, pt.created_at DESC';

        return await this.query(sql, params);
    }

    async getAccountTransactionHistory(accountId, dateFrom = null, dateTo = null) {
        let sql = `
            SELECT * FROM account_transactions 
            WHERE account_id = ?
        `;
        const params = [accountId];

        if (dateFrom) {
            sql += ' AND transaction_date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND transaction_date <= ?';
            params.push(dateTo);
        }

        sql += ' ORDER BY transaction_date DESC, created_at DESC';

        return await this.query(sql, params);
    }

    // DASHBOARD METHODS
    async getDashboardData() {
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's sales
        const todaySales = await this.get(`
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM sales_invoices 
            WHERE DATE(invoice_date) = ? AND is_cancelled = 0 AND is_deleted = 0
        `, [today]);

        // Get today's purchases
        const todayPurchases = await this.get(`
            SELECT COALESCE(SUM(total_amount), 0) as total
            FROM purchase_invoices 
            WHERE DATE(bill_date) = ? AND is_cancelled = 0 AND is_deleted = 0
        `, [today]);

        // Get cash balance
        const cashBalance = await this.get(`
            SELECT COALESCE(SUM(current_balance), 0) as total
            FROM accounts 
            WHERE account_type = 'cash' AND is_deleted = 0
        `);

        // Get bank balance
        const bankBalance = await this.get(`
            SELECT COALESCE(SUM(current_balance), 0) as total
            FROM accounts 
            WHERE account_type = 'bank' AND is_deleted = 0
        `);

        // Get receivables (customer balances) - using real-time calculation
        const receivables = await this.get(`
            SELECT COALESCE(SUM(
                p.opening_balance + 
                COALESCE(sales.total_outstanding_sales, 0) - 
                COALESCE(payments_in.total_payments_received, 0)
            ), 0) as total
            FROM parties p
            LEFT JOIN (
                SELECT 
                    party_id, 
                    SUM(balance_amount) as total_outstanding_sales
                FROM sales_invoices 
                WHERE is_cancelled = 0 AND is_deleted = 0 AND balance_amount > 0
                GROUP BY party_id
            ) sales ON p.party_id = sales.party_id
            LEFT JOIN (
                SELECT 
                    party_id,
                    SUM(amount) as total_payments_received
                FROM payments
                WHERE payment_type = 'payment_in' AND is_deleted = 0
                GROUP BY party_id
            ) payments_in ON p.party_id = payments_in.party_id
            WHERE (p.party_type = 'customer' OR p.party_type = 'both') 
            AND p.is_deleted = 0
            AND (p.opening_balance + COALESCE(sales.total_outstanding_sales, 0) - COALESCE(payments_in.total_payments_received, 0)) > 0
        `);

        // Get payables (supplier balances)
        const payables = await this.get(`
            SELECT COALESCE(SUM(current_balance), 0) as total
            FROM parties 
            WHERE (party_type = 'supplier' OR party_type = 'both') 
            AND current_balance > 0 AND is_deleted = 0
        `);

        // Get low stock items
        const lowStockItems = await this.query(`
            SELECT product_name, current_stock, min_stock
            FROM items 
            WHERE current_stock <= min_stock AND min_stock > 0 
            AND is_deleted = 0
            ORDER BY (current_stock - min_stock)
            LIMIT 10
        `);

        return {
            todaySales: todaySales?.total || 0,
            todayPurchases: todayPurchases?.total || 0,
            cashBalance: cashBalance?.total || 0,
            bankBalance: bankBalance?.total || 0,
            receivables: receivables?.total || 0,
            payables: payables?.total || 0,
            lowStockItems: lowStockItems || []
        };
    }
}

// Create singleton instance
const db = new DatabaseService();
export default db;