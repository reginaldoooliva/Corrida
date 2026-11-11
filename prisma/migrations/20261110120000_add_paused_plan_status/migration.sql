-- Spec AD-005 / PLANS-01: a saved plan the user is not following. The partial unique index
-- "Plan_userId_active_key" (WHERE status = 'ACTIVE') already lets a user hold several PAUSED plans
-- while keeping one ACTIVE at most (PLANS-02), so it stays as it is.
ALTER TYPE "PlanStatus" ADD VALUE 'PAUSED';
