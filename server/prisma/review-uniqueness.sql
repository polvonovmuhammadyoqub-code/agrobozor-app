-- Existing deployments: inspect duplicates before applying the unique index.
-- This script never deletes reviews. Index creation fails safely if duplicates exist.
SELECT order_id, reviewer_id, target_user_id, COUNT(*)
FROM "Review"
GROUP BY order_id, reviewer_id, target_user_id
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Review_order_id_reviewer_id_target_user_id_key"
ON "Review" (order_id, reviewer_id, target_user_id);
