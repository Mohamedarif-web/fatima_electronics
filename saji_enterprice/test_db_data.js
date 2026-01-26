// Test script to check database tables for transaction history data
// Run this in browser console to see what data exists

async function testDatabaseData() {
    console.log('🔍 DATABASE INSPECTION TEST');
    console.log('============================');
    
    try {
        // Check if payment_transactions table exists and has data
        console.log('\n1️⃣ CHECKING PAYMENT_TRANSACTIONS TABLE:');
        try {
            const paymentTransactions = await db.query('SELECT * FROM payment_transactions ORDER BY created_at DESC');
            console.log(`📊 Total payment transactions: ${paymentTransactions.length}`);
            if (paymentTransactions.length > 0) {
                console.log('📋 Sample payment transactions:');
                paymentTransactions.slice(0, 3).forEach((pt, index) => {
                    console.log(`   ${index + 1}. Account ID: ${pt.account_id}, Amount: ₹${pt.amount}, Type: ${pt.payment_type}, Date: ${pt.payment_date}`);
                });
            }
        } catch (error) {
            console.log('❌ payment_transactions table not found or error:', error.message);
        }

        // Check if account_transactions table exists and has data
        console.log('\n2️⃣ CHECKING ACCOUNT_TRANSACTIONS TABLE:');
        try {
            const accountTransactions = await db.query('SELECT * FROM account_transactions ORDER BY created_at DESC');
            console.log(`📊 Total account transactions: ${accountTransactions.length}`);
            if (accountTransactions.length > 0) {
                console.log('📋 Sample account transactions:');
                accountTransactions.slice(0, 3).forEach((at, index) => {
                    console.log(`   ${index + 1}. Account ID: ${at.account_id}, Amount: ₹${at.amount}, Type: ${at.transaction_type}, Date: ${at.transaction_date}`);
                });
            }
        } catch (error) {
            console.log('❌ account_transactions table not found or error:', error.message);
        }

        // Check sales_invoices for payments
        console.log('\n3️⃣ CHECKING SALES_INVOICES WITH PAYMENTS:');
        try {
            const salesWithPayments = await db.query(`
                SELECT invoice_id, invoice_number, account_id, total_amount, payment_type, invoice_date, party_id
                FROM sales_invoices 
                WHERE payment_type = 'cash' AND account_id IS NOT NULL AND is_deleted = 0
                ORDER BY created_at DESC
                LIMIT 5
            `);
            console.log(`📊 Sales invoices with cash payments: ${salesWithPayments.length}`);
            if (salesWithPayments.length > 0) {
                console.log('📋 Sample sales with payments:');
                salesWithPayments.forEach((si, index) => {
                    console.log(`   ${index + 1}. Invoice: ${si.invoice_number}, Account: ${si.account_id}, Amount: ₹${si.total_amount}, Date: ${si.invoice_date}`);
                });
            }
        } catch (error) {
            console.log('❌ Error checking sales invoices:', error.message);
        }

        // Check accounts table
        console.log('\n4️⃣ CHECKING ACCOUNTS TABLE:');
        try {
            const accounts = await db.query('SELECT account_id, account_name, account_type, current_balance FROM accounts WHERE is_deleted = 0');
            console.log(`📊 Total accounts: ${accounts.length}`);
            if (accounts.length > 0) {
                console.log('📋 Account balances:');
                accounts.forEach((acc, index) => {
                    console.log(`   ${index + 1}. ID: ${acc.account_id}, Name: ${acc.account_name}, Type: ${acc.account_type}, Balance: ₹${acc.current_balance}`);
                });
            }
        } catch (error) {
            console.log('❌ Error checking accounts:', error.message);
        }

        // Check table structures
        console.log('\n5️⃣ CHECKING TABLE STRUCTURES:');
        try {
            const paymentTableInfo = await db.query("PRAGMA table_info(payment_transactions)");
            console.log('📋 payment_transactions structure:', paymentTableInfo.map(col => col.name).join(', '));
        } catch (error) {
            console.log('❌ payment_transactions structure check failed');
        }

        try {
            const accountTableInfo = await db.query("PRAGMA table_info(account_transactions)");
            console.log('📋 account_transactions structure:', accountTableInfo.map(col => col.name).join(', '));
        } catch (error) {
            console.log('❌ account_transactions structure check failed');
        }

    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
}

// Usage: Copy and paste this into browser console, then run:
console.log('🚀 Database test function loaded. Run: testDatabaseData()');