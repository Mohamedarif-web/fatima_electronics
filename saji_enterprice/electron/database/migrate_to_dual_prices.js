// Migration script to convert from single sale_price to dealer_price and customer_price
// Run this once to update existing databases

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function migrateDualPrices() {
  const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'saji-enterprises', 'database.sqlite');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('📂 Database opened successfully');
      
      db.serialize(() => {
        // Check if migration is needed
        db.all("PRAGMA table_info(items)", (err, columns) => {
          if (err) {
            console.error('Error checking table structure:', err);
            db.close();
            reject(err);
            return;
          }
          
          const hasSalePrice = columns.some(col => col.name === 'sale_price');
          const hasDealerPrice = columns.some(col => col.name === 'dealer_price');
          const hasCustomerPrice = columns.some(col => col.name === 'customer_price');
          
          if (!hasSalePrice && hasDealerPrice && hasCustomerPrice) {
            console.log('✅ Database already migrated to dual prices!');
            db.close();
            resolve({ alreadyMigrated: true });
            return;
          }
          
          if (!hasSalePrice) {
            console.log('⚠️ No sale_price column found - database might be empty or corrupted');
            db.close();
            reject(new Error('Invalid database structure'));
            return;
          }
          
          console.log('🔄 Starting migration...');
          
          // Begin transaction
          db.run("BEGIN TRANSACTION", (err) => {
            if (err) {
              console.error('Error starting transaction:', err);
              db.close();
              reject(err);
              return;
            }
            
            // Step 1: Add new columns
            console.log('📝 Adding dealer_price column...');
            db.run(`ALTER TABLE items ADD COLUMN dealer_price DECIMAL(10,2) NOT NULL DEFAULT 0`, (err) => {
              if (err && !err.message.includes('duplicate column')) {
                console.error('Error adding dealer_price column:', err);
                db.run("ROLLBACK");
                db.close();
                reject(err);
                return;
              }
              
              console.log('📝 Adding customer_price column...');
              db.run(`ALTER TABLE items ADD COLUMN customer_price DECIMAL(10,2) NOT NULL DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                  console.error('Error adding customer_price column:', err);
                  db.run("ROLLBACK");
                  db.close();
                  reject(err);
                  return;
                }
                
                // Step 2: Add price type columns
                console.log('📝 Adding dealer_price_type column...');
                db.run(`ALTER TABLE items ADD COLUMN dealer_price_type TEXT CHECK(dealer_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax'`, (err) => {
                  if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding dealer_price_type column:', err);
                    db.run("ROLLBACK");
                    db.close();
                    reject(err);
                    return;
                  }
                  
                  console.log('📝 Adding customer_price_type column...');
                  db.run(`ALTER TABLE items ADD COLUMN customer_price_type TEXT CHECK(customer_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax'`, (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                      console.error('Error adding customer_price_type column:', err);
                      db.run("ROLLBACK");
                      db.close();
                      reject(err);
                      return;
                    }
                    
                    // Step 3: Copy sale_price to both new columns and sale_price_type to price types
                    console.log('📋 Copying sale_price to dealer_price and customer_price...');
                    db.run(`UPDATE items SET dealer_price = sale_price, customer_price = sale_price, dealer_price_type = COALESCE(sale_price_type, 'without_tax'), customer_price_type = COALESCE(sale_price_type, 'without_tax')`, (err) => {
                      if (err) {
                        console.error('Error copying prices:', err);
                        db.run("ROLLBACK");
                        db.close();
                        reject(err);
                        return;
                      }
                  
                  // Step 4: Create new table without sale_price and sale_price_type
                  console.log('🔨 Creating new table structure...');
                  db.run(`
                    CREATE TABLE items_new (
                      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                      product_name TEXT NOT NULL,
                      item_code TEXT UNIQUE,
                      barcode TEXT,
                      hsn_code TEXT,
                      unit TEXT DEFAULT 'PCS',
                      dealer_price DECIMAL(10,2) NOT NULL DEFAULT 0,
                      dealer_price_type TEXT CHECK(dealer_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax',
                      customer_price DECIMAL(10,2) NOT NULL DEFAULT 0,
                      customer_price_type TEXT CHECK(customer_price_type IN ('with_tax', 'without_tax')) DEFAULT 'without_tax',
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
                  `, (err) => {
                    if (err) {
                      console.error('Error creating new table:', err);
                      db.run("ROLLBACK");
                      db.close();
                      reject(err);
                      return;
                    }
                    
                    // Step 5: Copy data to new table
                    console.log('📤 Copying data to new table...');
                    db.run(`
                      INSERT INTO items_new 
                      SELECT 
                        item_id, product_name, item_code, barcode, hsn_code, unit,
                        dealer_price, dealer_price_type, customer_price, customer_price_type,
                        purchase_price, purchase_price_type, gst_rate,
                        opening_stock, current_stock, min_stock,
                        is_active, is_deleted, created_at, updated_at
                      FROM items
                    `, (err) => {
                      if (err) {
                        console.error('Error copying data:', err);
                        db.run("ROLLBACK");
                        db.close();
                        reject(err);
                        return;
                      }
                      
                      // Step 5: Drop old table and rename new table
                      console.log('🗑️ Dropping old table...');
                      db.run(`DROP TABLE items`, (err) => {
                        if (err) {
                          console.error('Error dropping old table:', err);
                          db.run("ROLLBACK");
                          db.close();
                          reject(err);
                          return;
                        }
                        
                        console.log('✏️ Renaming new table...');
                        db.run(`ALTER TABLE items_new RENAME TO items`, (err) => {
                          if (err) {
                            console.error('Error renaming table:', err);
                            db.run("ROLLBACK");
                            db.close();
                            reject(err);
                            return;
                          }
                          
                          // Commit transaction
                          db.run("COMMIT", (err) => {
                            if (err) {
                              console.error('Error committing transaction:', err);
                              db.run("ROLLBACK");
                              db.close();
                              reject(err);
                              return;
                            }
                            
                            console.log('✅ Migration completed successfully!');
                            console.log('📊 Summary:');
                            console.log('   - Added dealer_price column');
                            console.log('   - Added dealer_price_type column');
                            console.log('   - Added customer_price column');
                            console.log('   - Added customer_price_type column');
                            console.log('   - Removed sale_price column');
                            console.log('   - Removed sale_price_type column');
                            console.log('   - Copied existing sale_price to both new price fields');
                            console.log('   - Copied existing sale_price_type to both new price type fields');
                            
                            db.close();
                            resolve({ success: true });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Run migration if called directly
if (require.main === module) {
  console.log('🚀 Starting database migration...\n');
  migrateDualPrices()
    .then((result) => {
      if (result.alreadyMigrated) {
        console.log('\n✅ No migration needed - database is up to date!');
      } else {
        console.log('\n✅ Migration completed successfully!');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { migrateDualPrices };
