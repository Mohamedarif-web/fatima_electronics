import db from './database.js';

// Test items data
const testItems = [
  {
    product_name: 'Samsung Galaxy S24',
    item_code: 'SAM-S24-001',
    barcode: '',
    hsn_code: '85171200',
    unit: 'PCS',
    sale_price: 75000,
    sale_price_type: 'without_tax',
    purchase_price: 65000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 25,
    min_stock: 5
  },
  {
    product_name: 'Apple iPhone 15',
    item_code: 'APL-IP15-002',
    barcode: '',
    hsn_code: '85171200',
    unit: 'PCS',
    sale_price: 95000,
    sale_price_type: 'without_tax',
    purchase_price: 85000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 15,
    min_stock: 3
  },
  {
    product_name: 'HP Laptop 15-inch',
    item_code: 'HP-LAP-003',
    barcode: '',
    hsn_code: '84713000',
    unit: 'PCS',
    sale_price: 45000,
    sale_price_type: 'without_tax',
    purchase_price: 38000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 10,
    min_stock: 2
  },
  {
    product_name: 'Sony Headphones WH-1000XM5',
    item_code: 'SON-HP-004',
    barcode: '',
    hsn_code: '85183000',
    unit: 'PCS',
    sale_price: 25000,
    sale_price_type: 'without_tax',
    purchase_price: 20000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 30,
    min_stock: 5
  },
  {
    product_name: 'Canon DSLR Camera EOS 90D',
    item_code: 'CAN-CAM-005',
    barcode: '',
    hsn_code: '90069100',
    unit: 'PCS',
    sale_price: 85000,
    sale_price_type: 'without_tax',
    purchase_price: 75000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 8,
    min_stock: 2
  },
  {
    product_name: 'Dell Monitor 24-inch',
    item_code: 'DEL-MON-006',
    barcode: '',
    hsn_code: '85285200',
    unit: 'PCS',
    sale_price: 15000,
    sale_price_type: 'without_tax',
    purchase_price: 12000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 20,
    min_stock: 4
  },
  {
    product_name: 'Logitech Wireless Mouse',
    item_code: 'LOG-MOU-007',
    barcode: '',
    hsn_code: '84716060',
    unit: 'PCS',
    sale_price: 2500,
    sale_price_type: 'without_tax',
    purchase_price: 2000,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 50,
    min_stock: 10
  },
  {
    product_name: 'USB-C Cable 3 Meter',
    item_code: 'USB-CAB-008',
    barcode: '',
    hsn_code: '85444900',
    unit: 'PCS',
    sale_price: 800,
    sale_price_type: 'without_tax',
    purchase_price: 600,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 100,
    min_stock: 20
  },
  {
    product_name: 'Portable Power Bank 20000mAh',
    item_code: 'PWR-BNK-009',
    barcode: '',
    hsn_code: '85078000',
    unit: 'PCS',
    sale_price: 3500,
    sale_price_type: 'without_tax',
    purchase_price: 2800,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 40,
    min_stock: 8
  },
  {
    product_name: 'Bluetooth Speaker JBL',
    item_code: 'JBL-SPK-010',
    barcode: '',
    hsn_code: '85182900',
    unit: 'PCS',
    sale_price: 5500,
    sale_price_type: 'without_tax',
    purchase_price: 4500,
    purchase_price_type: 'without_tax',
    gst_rate: 18,
    opening_stock: 35,
    min_stock: 7
  }
];

// Function to add test items if database is empty
export const addTestItems = async () => {
  try {
    // Check if items already exist
    const existingItems = await db.getItems();
    
    if (existingItems.length === 0) {
      console.log('No items found. Adding test items...');
      
      for (const item of testItems) {
        await db.saveItem(item);
      }
      
      console.log('✅ Successfully added 10 test items!');
      return true;
    } else {
      console.log(`Found ${existingItems.length} existing items. Skipping test data creation.`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error adding test items:', error);
    return false;
  }
};

// Function to force add test items (even if items exist)
export const forceAddTestItems = async () => {
  try {
    console.log('Adding test items...');
    
    for (const item of testItems) {
      await db.saveItem(item);
    }
    
    console.log('✅ Successfully added 10 test items!');
    return true;
  } catch (error) {
    console.error('❌ Error adding test items:', error);
    return false;
  }
};

export default { addTestItems, forceAddTestItems };