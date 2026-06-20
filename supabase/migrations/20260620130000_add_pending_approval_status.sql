-- Add 'pending_approval' to event_status enum
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'draft';
