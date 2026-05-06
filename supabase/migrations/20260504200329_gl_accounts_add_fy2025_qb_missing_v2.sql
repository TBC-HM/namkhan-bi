-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504200329
-- Name:    gl_accounts_add_fy2025_qb_missing_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Drop is_pl from inserts (generated). Same set of 31 accounts.

INSERT INTO gl.accounts (
  account_id, qb_account_number, account_name, qb_type, qb_detail_type,
  is_active, usali_subcategory, usali_line_label, mapping_status,
  cloudbeds_category, currency, source_file, mapped_at
) VALUES
('627111','627111','BCEL BANK FEE USD',                 'Expenses','BankCharges',TRUE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627112','627112','BCEL BANK TRANSFER USD (deleted)',  'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627113','627113','BCEL BANK TRANSFER LAK (deleted)',  'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627211','627211','BFL BANK FEE USD (deleted)',        'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627212','627212','BFL BANK TRANSFER USD (deleted)',   'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627213','627213','BFL BANK TRANSFER LAK (deleted)',   'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627311','627311','JDB BANK FEE USD (deleted)',        'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627312','627312','JDB BANK TRANSFER USD (deleted)',   'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627313','627313','JDB BANK TRANSFER LAK (deleted)',   'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627411','627411','BCEL CREDIT CARD COMM-MASTER CARD (deleted)','Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627511','627511','BFL CREDIT CARD COMM-MASTER CARD (deleted)','Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627601','627601','BCEL BANK COMMISSION (deleted)',    'Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('627611','627611','JDB CREDIT CARD COMM-MASTER CARD (deleted)','Expenses','BankCharges',FALSE,'A&G','Bank Fees','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('658120','658120','ELECTRICITY FEE (deleted)',         'Expenses','UtilitiesExpense',FALSE,'Utilities','Electricity','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('ADMIN AND OFFICE EXPENSE',NULL,'ADMIN AND OFFICE EXPENSE','Expenses','OfficeExpenses',TRUE,'A&G','Office Expense','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('AIRCONDITIONER R&M (deleted)',NULL,'AIRCONDITIONER R&M (deleted)','Expenses','RepairsAndMaintenance',FALSE,'POM','Repairs & Maintenance','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('CANTEEN SUPPLIES',NULL,'CANTEEN SUPPLIES','Expenses','SuppliesAndMaterials',TRUE,'Other Operating Expenses','Operating Supplies','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('ELECTRICAL MACHINE R&M',NULL,'ELECTRICAL MACHINE R&M','Expenses','RepairsAndMaintenance',TRUE,'POM','Repairs & Maintenance','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('EXTERNAL LABOR (deleted)',NULL,'EXTERNAL LABOR (deleted)','Expenses','PayrollAndBenefits',FALSE,'Payroll & Related','Wages & Benefits','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('FLOODING REPAIR AND  RENOVATION COST',NULL,'FLOODING REPAIR AND RENOVATION COST','Expenses','RepairsAndMaintenance',TRUE,'POM','Repairs & Maintenance','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('FURNITURE MATERIAL SUPPLIES (deleted)',NULL,'FURNITURE MATERIAL SUPPLIES (deleted)','Expenses','SuppliesAndMaterials',FALSE,'POM','Repairs & Maintenance','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('GRANDEUR LAW AND PARTNER (deleted)',NULL,'GRANDEUR LAW AND PARTNER (deleted)','Expenses','LegalAndProfessionalFees',FALSE,'A&G','Legal & Professional','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('HR ADS COST (deleted)',NULL,'HR ADS COST (deleted)','Expenses','AdvertisingAndPromotion',FALSE,'A&G','Recruitment','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('Inventory Shrinkage',NULL,'Inventory Shrinkage','Cost of Goods Sold','SuppliesAndMaterialsCogs',TRUE,'Cost of Sales','Inventory Shrinkage','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('KITCHEN SUPPLIES',NULL,'KITCHEN SUPPLIES','Expenses','SuppliesAndMaterials',TRUE,'Other Operating Expenses','Operating Supplies','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('MAGAZINE AND CORPORATION (deleted)',NULL,'MAGAZINE AND CORPORATION (deleted)','Expenses','AdvertisingAndPromotion',FALSE,'Sales & Marketing','Advertising','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('PRINTING FOR MARKETING',NULL,'PRINTING FOR MARKETING','Expenses','AdvertisingAndPromotion',TRUE,'Sales & Marketing','Advertising','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('SYSTEM - QUICKBOOKS ONLINE (deleted)',NULL,'SYSTEM - QUICKBOOKS ONLINE (deleted)','Expenses','OfficeExpenses',FALSE,'A&G','Systems & Software','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('SYSTEM - SOFTZOO INVENTORY (deleted)',NULL,'SYSTEM - SOFTZOO INVENTORY (deleted)','Expenses','OfficeExpenses',FALSE,'A&G','Systems & Software','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('SYSTEM EXPENSES - SMALLPDF (deleted)',NULL,'SYSTEM EXPENSES - SMALLPDF (deleted)','Expenses','OfficeExpenses',FALSE,'A&G','Systems & Software','mapped','admin','USD','qb_pl_2025_xlsx',now()),
('Uncategorised Expense',NULL,'Uncategorised Expense','Expenses','OtherMiscellaneousServiceCost',TRUE,'A&G','Uncategorised','mapped','admin','USD','qb_pl_2025_xlsx',now())
ON CONFLICT (account_id) DO NOTHING;