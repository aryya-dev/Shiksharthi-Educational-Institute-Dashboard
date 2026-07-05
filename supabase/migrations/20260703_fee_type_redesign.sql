-- Fee System Redesign: Add fee_type, scholarship_percentage, monthly_amount, num_installments
-- This migration alters student_fees to support Installment and Monthly fee modes.

-- 1. Add fee_type column (Installment or Monthly)
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) NOT NULL DEFAULT 'Installment'
  CHECK (fee_type IN ('Installment', 'Monthly'));

-- 2. Add scholarship_percentage (0–100, optional, defaults 0)
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS scholarship_percentage NUMERIC(5, 2) DEFAULT 0.00 NOT NULL;

-- 3. Add monthly_amount for Monthly type fees
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- 4. Add num_installments for Installment type (1–4)
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS num_installments INT DEFAULT 4 NOT NULL
  CHECK (num_installments BETWEEN 1 AND 4);

-- 5. Add tuition_fee and admission_fee columns
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS tuition_fee NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;
ALTER TABLE student_fees ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;
