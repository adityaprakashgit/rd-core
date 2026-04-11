-- Normalize workflow image policy buckets to canonical category keys.
-- Idempotent: can be safely re-run.
WITH normalized AS (
  SELECT
    m.id,
    COALESCE((
      SELECT ARRAY(
        SELECT dedup.normalized_value
        FROM (
          SELECT mapped.normalized_value, MIN(mapped.ord) AS first_ord
          FROM (
            SELECT
              CASE
                WHEN UPPER(TRIM(value)) IN (
                  'BEFORE',
                  'AFTER',
                  'BAG_WITH_LOT_NO',
                  'MATERIAL_VISIBLE',
                  'SAMPLING_IN_PROGRESS',
                  'SEALED_BAG',
                  'SEAL_CLOSEUP',
                  'BAG_CONDITION',
                  'DAMAGE_PHOTO',
                  'HOMOGENEOUS',
                  'LOT_OVERVIEW',
                  'BAG_CLOSEUP',
                  'LABEL_CLOSEUP',
                  'INSPECTION_IN_PROGRESS',
                  'CONTAMINATION_PHOTO'
                ) THEN UPPER(TRIM(value))
                WHEN TRIM(value) = 'Bag photo with visible LOT no' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Material in bag' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'During Sampling Photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN TRIM(value) = 'Sample Completion' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Seal on bag' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'Bag condition' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'Whole Job bag palletized and packed' THEN 'LOT_OVERVIEW'
                WHEN TRIM(value) = 'BagphotowithvisibleLOTno' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'BagconditionBagphotowithvisibleLOTno' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'SealCloseup' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'MaterialVisible' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'Bag photo' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Seal photo' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Sampling during photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN UPPER(TRIM(value)) IN ('BAG', 'LOT_BAG') THEN 'BAG_WITH_LOT_NO'
                WHEN UPPER(TRIM(value)) IN ('SEAL', 'LOT_SEAL') THEN 'SEALED_BAG'
                WHEN UPPER(TRIM(value)) = 'DURING' THEN 'SAMPLING_IN_PROGRESS'
                ELSE NULL
              END AS normalized_value,
              ord
            FROM UNNEST(m."requiredImageCategories") WITH ORDINALITY AS source(value, ord)
          ) AS mapped
          WHERE mapped.normalized_value IS NOT NULL
          GROUP BY mapped.normalized_value
        ) AS dedup
        ORDER BY dedup.first_ord
      )
    ), ARRAY[]::TEXT[]) AS required_norm,
    COALESCE((
      SELECT ARRAY(
        SELECT dedup.normalized_value
        FROM (
          SELECT mapped.normalized_value, MIN(mapped.ord) AS first_ord
          FROM (
            SELECT
              CASE
                WHEN UPPER(TRIM(value)) IN (
                  'BEFORE',
                  'AFTER',
                  'BAG_WITH_LOT_NO',
                  'MATERIAL_VISIBLE',
                  'SAMPLING_IN_PROGRESS',
                  'SEALED_BAG',
                  'SEAL_CLOSEUP',
                  'BAG_CONDITION',
                  'DAMAGE_PHOTO',
                  'HOMOGENEOUS',
                  'LOT_OVERVIEW',
                  'BAG_CLOSEUP',
                  'LABEL_CLOSEUP',
                  'INSPECTION_IN_PROGRESS',
                  'CONTAMINATION_PHOTO'
                ) THEN UPPER(TRIM(value))
                WHEN TRIM(value) = 'Bag photo with visible LOT no' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Material in bag' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'During Sampling Photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN TRIM(value) = 'Sample Completion' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Seal on bag' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'Bag condition' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'Whole Job bag palletized and packed' THEN 'LOT_OVERVIEW'
                WHEN TRIM(value) = 'BagphotowithvisibleLOTno' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'BagconditionBagphotowithvisibleLOTno' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'SealCloseup' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'MaterialVisible' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'Bag photo' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Seal photo' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Sampling during photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN UPPER(TRIM(value)) IN ('BAG', 'LOT_BAG') THEN 'BAG_WITH_LOT_NO'
                WHEN UPPER(TRIM(value)) IN ('SEAL', 'LOT_SEAL') THEN 'SEALED_BAG'
                WHEN UPPER(TRIM(value)) = 'DURING' THEN 'SAMPLING_IN_PROGRESS'
                ELSE NULL
              END AS normalized_value,
              ord
            FROM UNNEST(m."optionalImageCategories") WITH ORDINALITY AS source(value, ord)
          ) AS mapped
          WHERE mapped.normalized_value IS NOT NULL
          GROUP BY mapped.normalized_value
        ) AS dedup
        ORDER BY dedup.first_ord
      )
    ), ARRAY[]::TEXT[]) AS optional_norm,
    COALESCE((
      SELECT ARRAY(
        SELECT dedup.normalized_value
        FROM (
          SELECT mapped.normalized_value, MIN(mapped.ord) AS first_ord
          FROM (
            SELECT
              CASE
                WHEN UPPER(TRIM(value)) IN (
                  'BEFORE',
                  'AFTER',
                  'BAG_WITH_LOT_NO',
                  'MATERIAL_VISIBLE',
                  'SAMPLING_IN_PROGRESS',
                  'SEALED_BAG',
                  'SEAL_CLOSEUP',
                  'BAG_CONDITION',
                  'DAMAGE_PHOTO',
                  'HOMOGENEOUS',
                  'LOT_OVERVIEW',
                  'BAG_CLOSEUP',
                  'LABEL_CLOSEUP',
                  'INSPECTION_IN_PROGRESS',
                  'CONTAMINATION_PHOTO'
                ) THEN UPPER(TRIM(value))
                WHEN TRIM(value) = 'Bag photo with visible LOT no' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Material in bag' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'During Sampling Photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN TRIM(value) = 'Sample Completion' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Seal on bag' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'Bag condition' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'Whole Job bag palletized and packed' THEN 'LOT_OVERVIEW'
                WHEN TRIM(value) = 'BagphotowithvisibleLOTno' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'BagconditionBagphotowithvisibleLOTno' THEN 'BAG_CONDITION'
                WHEN TRIM(value) = 'SealCloseup' THEN 'SEAL_CLOSEUP'
                WHEN TRIM(value) = 'MaterialVisible' THEN 'MATERIAL_VISIBLE'
                WHEN TRIM(value) = 'Bag photo' THEN 'BAG_WITH_LOT_NO'
                WHEN TRIM(value) = 'Seal photo' THEN 'SEALED_BAG'
                WHEN TRIM(value) = 'Sampling during photo' THEN 'SAMPLING_IN_PROGRESS'
                WHEN UPPER(TRIM(value)) IN ('BAG', 'LOT_BAG') THEN 'BAG_WITH_LOT_NO'
                WHEN UPPER(TRIM(value)) IN ('SEAL', 'LOT_SEAL') THEN 'SEALED_BAG'
                WHEN UPPER(TRIM(value)) = 'DURING' THEN 'SAMPLING_IN_PROGRESS'
                ELSE NULL
              END AS normalized_value,
              ord
            FROM UNNEST(m."hiddenImageCategories") WITH ORDINALITY AS source(value, ord)
          ) AS mapped
          WHERE mapped.normalized_value IS NOT NULL
          GROUP BY mapped.normalized_value
        ) AS dedup
        ORDER BY dedup.first_ord
      )
    ), ARRAY[]::TEXT[]) AS hidden_norm
  FROM "ModuleWorkflowSettings" AS m
),
repaired AS (
  SELECT
    n.id,
    CASE
      WHEN CARDINALITY(n.required_norm) = 0
       AND CARDINALITY(n.optional_norm) = 0
       AND CARDINALITY(n.hidden_norm) = 0
      THEN ARRAY[
        'BAG_WITH_LOT_NO',
        'MATERIAL_VISIBLE',
        'SAMPLING_IN_PROGRESS',
        'SEALED_BAG',
        'SEAL_CLOSEUP',
        'BAG_CONDITION'
      ]::TEXT[]
      ELSE n.required_norm
    END AS required_final,
    CASE
      WHEN CARDINALITY(n.required_norm) = 0
       AND CARDINALITY(n.optional_norm) = 0
       AND CARDINALITY(n.hidden_norm) = 0
      THEN ARRAY['LOT_OVERVIEW']::TEXT[]
      ELSE n.optional_norm
    END AS optional_final,
    CASE
      WHEN CARDINALITY(n.required_norm) = 0
       AND CARDINALITY(n.optional_norm) = 0
       AND CARDINALITY(n.hidden_norm) = 0
      THEN ARRAY[]::TEXT[]
      ELSE n.hidden_norm
    END AS hidden_final
  FROM normalized AS n
)
UPDATE "ModuleWorkflowSettings" AS m
SET
  "requiredImageCategories" = r.required_final,
  "optionalImageCategories" = r.optional_final,
  "hiddenImageCategories" = r.hidden_final
FROM repaired AS r
WHERE m.id = r.id;
