/**
 * FRESH IMPORT - Clear and Import Items from Excel
 * 
 * This script:
 * 1. Clears all existing items from database
 * 2. Imports fresh items from Excel
 * 3. Uses DESCRIPTION column as Product Name
 * 4. Auto-generates item codes
 * 
 * Usage: node import_fresh_items.cjs
 */

const XLSX = require('xlsx');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const os = require('os');

// Path to your Excel file
const EXCEL_FILE_PATH = 'C:\\Users\\ELCOT\\Documents\\GitHub\\fatima_electronics\\items.xlsx';

// Path to database (AppData)
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'saji_enter.db');

async function importFreshItems() {
  console.log('========================================');
  console.log('  FRESH IMPORT FROM EXCEL');
  console.log('========================================\n');
  
  try {
    // Read Excel file
    console.log('📂 Reading Excel file:', EXCEL_FILE_PATH);
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    console.log('📄 Sheet name:', sheetName);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('📊 Total rows in Excel:', jsonData.length);
    console.log('📋 Sample row:', jsonData[0]);
    console.log('');
    
    if (jsonData.length === 0) {
      console.error('❌ Excel file is empty!');
      return;
    }
    
    // Connect to database
    console.log('🔗 Connecting to database:', DB_PATH);
    const db = new sqlite3.Database(DB_PATH);
    
    // Create items table if it doesn't exist
    console.log('🔧 Ensuring items table exists...');
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS items (
          item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_name TEXT NOT NULL,
          item_code TEXT UNIQUE,
          barcode TEXT,
          hsn_code TEXT,
          description TEXT,
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
        )
      `, [], (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Items table ready');
          resolve();
        }
      });
    });
    
    // STEP 1: Clear all existing items
    console.log('');
    console.log('🗑️  STEP 1: Clearing all existing items...');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM items', [], function(err) {
        if (err) reject(err);
        else {
          console.log(`✅ Deleted ${this.changes} existing items`);
          resolve();
        }
      });
    });
    
    // Reset auto-increment
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM sqlite_sequence WHERE name='items'", [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('');
    console.log('📥 STEP 2: Importing fresh items from Excel...');
    console.log('');
    
    // Find DESCRIPTION column (with or without space)
    const firstRow = jsonData[0];
    const columnNames = Object.keys(firstRow);
    const descriptionColumn = columnNames.find(col => 
      col.trim().toLowerCase().includes('description')
    );
    
    if (!descriptionColumn) {
      console.error('❌ Could not find DESCRIPTION column!');
      console.error('   Available columns:', columnNames.join(', '));
      db.close();
      return;
    }
    
    console.log('✅ Using column:', descriptionColumn);
    console.log('');
    
    let importedCount = 0;
    let skippedCount = 0;
    
    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const productName = row[descriptionColumn]?.toString().trim();
      
      if (!productName || productName === '') {
        skippedCount++;
        continue;
      }
      
      // Auto-generate item code
      const baseCode = productName
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') || 'ITM';
      const itemCode = `${baseCode}${String(i + 1).padStart(4, '0')}`;
      
      // Insert item
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO items (
            product_name, 
            item_code, 
            unit, 
            sale_price, 
            sale_price_type,
            purchase_price, 
            purchase_price_type,
            gst_rate, 
            opening_stock, 
            current_stock, 
            min_stock,
            is_deleted,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            productName,
            itemCode,
            'PCS',
            0,
            'without_tax',
            0,
            'without_tax',
            0,
            0,
            0,
            0,
            0
          ],
          function(err) {
            if (err) {
              console.log(`⚠️  Row ${i + 1}: Error - ${err.message}`);
              skippedCount++;
              resolve();
            } else {
              importedCount++;
              if (importedCount % 100 === 0) {
                console.log(`✅ Imported ${importedCount} items...`);
              }
              resolve();
            }
          }
        );
      });
    }
    
    // Close database
    db.close();
    
    console.log('');
    console.log('========================================');
    console.log('  IMPORT COMPLETED');
    console.log('========================================');
    console.log(`✅ Imported: ${importedCount} items`);
    console.log(`⏭️  Skipped: ${skippedCount} items`);
    console.log('========================================\n');
    
    console.log('💡 TIP: Restart your application to see the new items!');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

// Run the import
importFreshItems();
