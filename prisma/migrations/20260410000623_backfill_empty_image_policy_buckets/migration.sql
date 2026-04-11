-- Backfill image policy buckets when all buckets are empty.
-- This preserves custom policy rows while repairing unusable empty-state configs.
UPDATE "ModuleWorkflowSettings"
SET
  "requiredImageCategories" = ARRAY[
    'Bag photo with visible LOT no',
    'Material in bag',
    'During Sampling Photo',
    'Sample Completion',
    'Seal on bag',
    'Bag condition'
  ]::TEXT[],
  "optionalImageCategories" = ARRAY['Whole Job bag palletized and packed']::TEXT[],
  "hiddenImageCategories" = ARRAY[]::TEXT[]
WHERE
  COALESCE(array_length("requiredImageCategories", 1), 0) = 0
  AND COALESCE(array_length("optionalImageCategories", 1), 0) = 0
  AND COALESCE(array_length("hiddenImageCategories", 1), 0) = 0;
