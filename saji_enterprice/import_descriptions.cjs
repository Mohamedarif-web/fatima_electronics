/**
 * Import Item Descriptions from Excel
 * 
 * This script reads items.xlsx and updates item descriptions in the database
 * Usage: node import_descriptions.js
 */

const XLSX = require('xlsx');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Path to your Excel file
const EXCEL_FILE_PATH = 'C:\\Users\\ELCOT\\Documents\\GitHub\\fatima_electronics\\items.xlsx';

// Path to your database
const DB_PATH = path.join(__dirname, 'fatima_electronics.db');

async function importDescriptions() {
  console.log('========================================');
  console.log('  IMPORT DESCRIPTIONS FROM EXCEL');
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
    
    if (jsonData.length === 0) {
      console.error('❌ Excel file is empty!');
      return;
    }
    
    // Show sample row to understand structure
    console.log('\n📋 Excel columns found:', Object.keys(jsonData[0]).join(', '));
    console.log('📋 Sample row:', jsonData[0]);
    console.log('');
    
    // Auto-detect column names (flexible matching)
    const firstRow = jsonData[0];
    const columnNames = Object.keys(firstRow);
    
    // Find identifier column - for this Excel, use BRAND column
    let identifierColumn = columnNames.find(col => 
      col.toLowerCase().includes('item') ||
      col.toLowerCase().includes('product') ||
      col.toLowerCase().includes('sku') ||
      col.toLowerCase().includes('code') ||
      col.toLowerCase().includes('name')
    );
    
    // If not found, try BRAND column
    if (!identifierColumn) {
      identifierColumn = columnNames.find(col => col.trim().toUpperCase() === 'BRAND');
    }
    
    // Find description column - handle space before DESCRIPTION
    const descriptionColumn = columnNames.find(col => 
      col.trim().toLowerCase().includes('description') ||
      col.trim().toLowerCase().includes('desc') ||
      col.trim().toLowerCase().includes('details')
    );
    
    if (!identifierColumn) {
      console.error('❌ Could not find item identifier column!');
      console.error('   Available columns:', columnNames.join(', '));
      console.error('   Please ensure Excel has a column like: Item Code, Product Name, SKU, etc.');
      return;
    }
    
    if (!descriptionColumn) {
      console.error('❌ Could not find description column!');
      console.error('   Available columns:', columnNames.join(', '));
      console.error('   Please ensure Excel has a column like: Description, Desc, Details, etc.');
      return;
    }
    
    console.log('✅ Using identifier column:', identifierColumn);
    console.log('✅ Using description column:', descriptionColumn);
    console.log('');
    
    // Connect to database
    console.log('🔗 Connecting to database:', DB_PATH);
    const db = new sqlite3.Database(DB_PATH);
    
    // Get all items from database
    const allItems = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM items WHERE is_deleted = 0', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('📦 Total items in database:', allItems.length);
    console.log('');
    console.log('🔄 Starting import...\n');
    
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const identifier = row[identifierColumn]?.toString().trim();
      const description = row[descriptionColumn]?.toString().trim();
      
      if (!identifier || !description) {
        console.log(`⏭️  Row ${i + 1}: Skipped (missing data)`);
        skippedCount++;
        continue;
      }
      
      // Try to find item by different fields
      // Check if identifier matches product_name or item_code
      const item = allItems.find(item => 
        (item.item_code && item.item_code.toLowerCase() === identifier.toLowerCase()) ||
        (item.product_name && item.product_name.toLowerCase() === identifier.toLowerCase()) ||
        (item.product_name && item.product_name.toLowerCase().includes(identifier.toLowerCase())) ||
        (item.item_id && item.item_id.toString() === identifier)
      );
      
      if (item) {
        // Update description
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE items SET description = ? WHERE item_id = ?',
            [description, item.item_id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        updatedCount++;
        console.log(`✅ Row ${i + 1}: Updated "${item.product_name}"`);
        console.log(`   Description: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);
      } else {
        notFoundCount++;
        console.log(`⚠️  Row ${i + 1}: Item not found - "${identifier}"`);
      }
    }
    
    // Close database
    db.close();
    
    console.log('');
    console.log('========================================');
    console.log('  IMPORT COMPLETED');
    console.log('========================================');
    console.log(`✅ Updated: ${updatedCount} items`);
    console.log(`⚠️  Not found: ${notFoundCount} items`);
    console.log(`⏭️  Skipped: ${skippedCount} items`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

// Run the import
importDescriptions();
