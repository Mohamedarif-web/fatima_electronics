// Debug script to test transaction history
// Run this in browser console after creating a sales invoice

async function debugTransactionHistory(accountId = 1) {
    console.log('🔍 DEBUG: Transaction History for Account ID:', accountId);
    
    try {
        // Test if payment tables exist
        console.log('📊 Testing payment tables...');
        
        const paymentCount = await db.query('SELECT COUNT(*) as count FROM payment_transactions');
        console.log('💳 Payment transactions count:', paymentCount[0]?.count || 0);
        
        const accountTxnCount = await db.query('SELECT COUNT(*) as count FROM account_transactions');
        console.log('🏦 Account transactions count:', accountTxnCount[0]?.count || 0);
        
        // Get all payment transactions for the account
        console.log('📋 Getting payment history for account:', accountId);
        const payments = await db.query(`
            SELECT * FROM payment_transactions 
            WHERE account_id = ? AND is_deleted = 0
            ORDER BY payment_date DESC
        `, [accountId]);
        console.log('💰 Payment transactions:', payments);
        
        // Get all account transactions
        console.log('📋 Getting account transactions for account:', accountId);
        const accountTxns = await db.query(`
            SELECT * FROM account_transactions 
            WHERE account_id = ?
            ORDER BY transaction_date DESC
        `, [accountId]);
        console.log('🏦 Account transactions:', accountTxns);
        
        // Test the getPaymentHistory function
        console.log('🔧 Testing getPaymentHistory function...');
        const paymentHistory = await db.getPaymentHistory({ account_id: accountId });
        console.log('📊 getPaymentHistory result:', paymentHistory);
        
        // Test the getAccountTransactionHistory function
        console.log('🔧 Testing getAccountTransactionHistory function...');
        const accountHistory = await db.getAccountTransactionHistory(accountId);
        console.log('📊 getAccountTransactionHistory result:', accountHistory);
        
        // Check if tables exist
        console.log('🔍 Checking table structure...');
        const paymentTableInfo = await db.query("PRAGMA table_info(payment_transactions)");
        console.log('💳 Payment transactions table structure:', paymentTableInfo);
        
        const accountTableInfo = await db.query("PRAGMA table_info(account_transactions)");
        console.log('🏦 Account transactions table structure:', accountTableInfo);
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

// Usage: Copy and paste this into browser console, then run:
// debugTransactionHistory(1); // Replace 1 with your account ID