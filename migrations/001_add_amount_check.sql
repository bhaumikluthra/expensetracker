-- Add a CHECK constraint to enforce amount between 0 and 100,000,000 (10 crore)
-- Use NOT VALID so existing rows are not rejected; constraint will apply to new inserts/updates.
ALTER TABLE expenses
  ADD CONSTRAINT chk_expenses_amount_range
  CHECK (amount >= 0 AND amount <= 100000000) NOT VALID;

-- After manually reviewing/cleaning problematic rows, run:
-- ALTER TABLE expenses VALIDATE CONSTRAINT chk_expenses_amount_range;
