-- DATABASE CLEANUP SCRIPT
-- This script identifies and fixes potentially corrupted expense amounts

-- 1. IDENTIFY SUSPICIOUS AMOUNTS (likely string-formatted as shown in UI)
-- Look for amounts that match the pattern of malformed Indian currency strings
SELECT 
    id, 
    user_id, 
    amount, 
    description, 
    created_at
FROM expenses
WHERE 
    -- Check for extremely large numbers (likely string-concatenated)
    amount > 1000000000 OR
    -- Check for NaN or null issues
    amount IS NULL OR
    amount < 0
ORDER BY amount DESC;

-- 2. FOR MANUAL REVIEW - Preview corrupted records (if any)
-- Run after SELECT above to review which records need fixing

-- 3. IF CORRUPTION DETECTED - Recalculate based on API patterns
-- Example: If you find a record with amount like 450000000000,
-- it was likely meant to be 45000 or a calculation error
-- Manual correction needed based on business logic

-- 4. PREVENT FUTURE CORRUPTION - Add validation check
-- (Run this after verifying data is clean)
-- ALTER TABLE expenses ADD CONSTRAINT check_valid_amount CHECK (amount >= 0 AND amount <= 1000000);

-- 5. VERIFY DATA INTEGRITY AFTER CLEANUP
SELECT 
    COUNT(*) as total_expenses,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount,
    MIN(amount) as min_amount,
    MAX(amount) as max_amount,
    COUNT(DISTINCT user_id) as unique_users
FROM expenses;

-- Note: Execute these queries in your database management tool
-- MySQL Command: mysql -u [username] -p [database_name] < DATABASE_CLEANUP.sql
-- PostgreSQL Command: psql -U [username] -d [database_name] -f DATABASE_CLEANUP.sql
