-- Harden notification delivery and UI reliability.
-- 1. Add metadata so notifications can link back to related records.
-- 2. Allow staff to create notifications from client-side workflows.
-- 3. Allow users to delete their own notifications because the UI exposes delete actions.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Staff can create notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.users actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('admin', 'trainer', 'validator', 'spd')
    )
  );

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);