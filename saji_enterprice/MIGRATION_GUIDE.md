# Database Migration Guide

## Changes Made

The application has been updated to support **two separate sales prices with tax options**:
- **Dealer Price**: Price for dealer customers (with tax type: with/without tax)
- **Customer Price**: Price for retail customers (with tax type: with/without tax)

This replaces the previous single `sale_price` and `sale_price_type` fields.

## What Changed

### 1. Database Schema (`electron/database/schema.sql`)
- ✅ Removed: `sale_price` (single price field)
- ✅ Removed: `sale_price_type` (with_tax/without_tax option)
- ✅ Added: `dealer_price` (dealer pricing)
- ✅ Added: `dealer_price_type` (with_tax/without_tax for dealer)
- ✅ Added: `customer_price` (customer pricing)
- ✅ Added: `customer_price_type` (with_tax/without_tax for customer)

### 2. Item Master Form (`src/pages/Items/ItemMaster.jsx`)
- ✅ Replaced single "Sale Price" field with four fields:
  - "Dealer Price" with "Dealer Price Type" dropdown (With Tax/Without Tax)
  - "Customer Price" with "Customer Price Type" dropdown (With Tax/Without Tax)
- ✅ Updated table display to show both prices
- ✅ Each price can independently be set as inclusive or exclusive of tax

### 3. Sales Invoice (`src/pages/Sales/SalesInvoice.jsx`)
- ✅ Added "Price Type" dropdown to select between Dealer/Customer pricing
- ✅ Modified `addItem()` function to use selected price type:
  - When "Dealer" is selected → uses `dealer_price` and `dealer_price_type`
  - When "Customer" is selected → uses `customer_price` and `customer_price_type`
- ✅ Updated item search dropdown to display both prices
- ✅ Smart tax calculation based on price type:
  - **With Tax (Inclusive)**: Tax is extracted from the price (reverse calculation)
  - **Without Tax**: Tax is added to the price (normal calculation)
- ✅ Tax column shows "Inclusive" for with-tax prices, "Applied" for without-tax prices

### 4. Database Functions (`src/utils/database.js`)
- ✅ Updated `saveItem()` to handle dealer_price and customer_price
- ✅ Removed references to sale_price and sale_price_type

## For New Installations

If you're starting fresh, simply run the app - it will use the new schema automatically.

## For Existing Databases

If you have an existing database with items, you need to migrate it:

### Migration Steps

1. **Backup your database first!**
   - Location: `%APPDATA%/saji-enterprises/database.sqlite` (Windows)
   - Location: `~/saji-enterprises/database.sqlite` (Mac/Linux)
   - Create a backup copy before proceeding

2. **Run the migration script:**
   ```bash
   cd electron/database
   node migrate_to_dual_prices.js
   ```

3. **What the migration does:**
   - Adds `dealer_price` and `dealer_price_type` columns
   - Adds `customer_price` and `customer_price_type` columns
   - Copies existing `sale_price` to BOTH new price fields
   - Copies existing `sale_price_type` to BOTH new price type fields
   - Removes old `sale_price` and `sale_price_type` columns

4. **After migration:**
   - All existing items will have the same price for both dealer and customer
   - All existing items will have the same price type for both (copied from old sale_price_type)
   - You can then edit items individually to set different prices and tax types

### Migration Safety

The migration script:
- ✅ Uses database transactions (rolls back on error)
- ✅ Checks if migration is already complete
- ✅ Preserves all existing data
- ✅ Provides detailed logging

## Usage After Migration

### Adding New Items

1. Go to Item Master
2. Fill in item details
3. Enter **Dealer Price** (e.g., ₹100)
4. Select **Dealer Price Type**:
   - "Without Tax" - GST will be added during invoicing
   - "With Tax (Inclusive)" - Price already includes GST
5. Enter **Customer Price** (e.g., ₹150)
6. Select **Customer Price Type**:
   - "Without Tax" - GST will be added during invoicing
   - "With Tax (Inclusive)" - Price already includes GST
7. All fields are independent

### Creating Sales Invoices

1. Open Sales Invoice
2. Select **Price Type** dropdown (Dealer or Customer)
3. Search and add items
4. Price will be populated based on selected type:
   - **Dealer** → uses dealer_price
   - **Customer** → uses customer_price
5. If a price is not set (0), it will show as ₹0

### Important Notes

- ✅ Each price (dealer/customer) can be set as **with tax** or **without tax** independently
- ✅ **With Tax**: Price includes GST - tax is extracted from total (reverse calculation)
- ✅ **Without Tax**: GST is added to price during invoicing (standard calculation)
- ⚠️ If dealer_price or customer_price is 0, it will show as 0 in invoices
- ✅ You can set different prices AND different tax types for dealers and customers
- ✅ Price type selection is per-invoice, not per-item
- ✅ Tax column in invoice shows "Inclusive" or "Applied" based on price type

## Rollback (If Needed)

If you need to rollback:

1. Restore your backup database
2. Revert to the previous version of the application

## Testing Checklist

After migration, test:
- ✅ Create a new item with both prices (dealer and customer)
- ✅ Set different tax types for dealer and customer prices
- ✅ Edit an existing item
- ✅ Create a sales invoice with "Dealer" price type (with tax)
- ✅ Create a sales invoice with "Dealer" price type (without tax)
- ✅ Create a sales invoice with "Customer" price type (with tax)
- ✅ Create a sales invoice with "Customer" price type (without tax)
- ✅ Verify tax calculations are correct for both inclusive and exclusive prices
- ✅ Check that tax column shows "Inclusive" or "Applied" correctly
- ✅ Check that existing invoices still display correctly

## Support

If you encounter issues during migration:
1. Check the migration script output for errors
2. Ensure your database backup is intact
3. Check that no other application instance is using the database
