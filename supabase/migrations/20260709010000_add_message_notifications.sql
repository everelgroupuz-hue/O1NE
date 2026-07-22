-- Update send_message to also create notifications for the recipient

CREATE OR REPLACE FUNCTION send_message(
  p_order_id uuid,
  p_sender_type text,
  p_sender_id text,
  p_receiver_id text,
  p_content text
)
RETURNS messages
LANGUAGE plpgsql
AS $$
DECLARE
  v_message messages;
  v_telegram_user_id bigint;
BEGIN
  INSERT INTO messages (order_id, sender_type, sender_id, receiver_id, content)
  VALUES (p_order_id, p_sender_type, p_sender_id, p_receiver_id, p_content)
  RETURNING * INTO v_message;

  -- Create in-app notification for the customer when admin sends a message
  IF p_sender_type = 'admin' THEN
    SELECT o.telegram_user_id INTO v_telegram_user_id
    FROM orders o WHERE o.id = p_order_id;

    IF v_telegram_user_id IS NOT NULL THEN
      INSERT INTO notifications (telegram_user_id, type, title, body, data)
      VALUES (
        v_telegram_user_id,
        'new_message',
        '💬 Новое сообщение',
        LEFT(p_content, 200),
        jsonb_build_object('order_id', p_order_id::text, 'sender_type', 'admin')
      );
    END IF;
  END IF;

  RETURN v_message;
END;
$$;
