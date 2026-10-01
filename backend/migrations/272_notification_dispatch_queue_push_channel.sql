ALTER TABLE notification_dispatch_queue
  DROP CONSTRAINT IF EXISTS notification_dispatch_queue_channel_check;

ALTER TABLE notification_dispatch_queue
  ADD CONSTRAINT notification_dispatch_queue_channel_check
  CHECK (
    channel::text = ANY (
      ARRAY[
        'email'::text,
        'chat'::text,
        'push'::text
      ]
    )
  );
