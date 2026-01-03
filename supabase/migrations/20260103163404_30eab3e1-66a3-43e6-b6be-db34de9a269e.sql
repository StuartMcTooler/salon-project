-- Create 5 demo staff members (invited by Jamie Byrne)
INSERT INTO staff_members (id, full_name, display_name, email, phone, is_active, tier, created_at)
VALUES
  ('d1000001-de00-0001-0001-000000000001', 'Dave Murphy', 'Dave Murphy', 'demo.dave@email.com', '+353851000001', false, 'pro', NOW() - INTERVAL '60 days'),
  ('d1000001-de00-0001-0001-000000000002', 'Sarah Kelly', 'Sarah Kelly', 'demo.sarah@email.com', '+353851000002', false, 'pro', NOW() - INTERVAL '55 days'),
  ('d1000001-de00-0001-0001-000000000003', 'Mike Collins', 'Mike Collins', 'demo.mike@email.com', '+353851000003', false, 'pro', NOW() - INTERVAL '50 days'),
  ('d1000001-de00-0001-0001-000000000004', 'Emma Walsh', 'Emma Walsh', 'demo.emma@email.com', '+353851000004', false, 'pro', NOW() - INTERVAL '45 days'),
  ('d1000001-de00-0001-0001-000000000005', 'Tom Brennan', 'Tom Brennan', 'demo.tom@email.com', '+353851000005', false, 'pro', NOW() - INTERVAL '40 days');

-- Create creative_invites showing Jamie Byrne invited these pros
INSERT INTO creative_invites (id, inviter_creative_id, invited_creative_id, invite_code, signup_completed_at, created_at)
VALUES
  ('11000001-de00-0001-0001-000000000001', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', 'DEMO-DAVE', NOW() - INTERVAL '58 days', NOW() - INTERVAL '60 days'),
  ('11000001-de00-0001-0001-000000000002', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', 'DEMO-SARAH', NOW() - INTERVAL '53 days', NOW() - INTERVAL '55 days'),
  ('11000001-de00-0001-0001-000000000003', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', 'DEMO-MIKE', NOW() - INTERVAL '48 days', NOW() - INTERVAL '50 days'),
  ('11000001-de00-0001-0001-000000000004', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', 'DEMO-EMMA', NOW() - INTERVAL '43 days', NOW() - INTERVAL '45 days'),
  ('11000001-de00-0001-0001-000000000005', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', 'DEMO-TOM', NOW() - INTERVAL '38 days', NOW() - INTERVAL '40 days');

-- Create referral_transactions (20 total, ~4 per pro over 4 weeks)
INSERT INTO referral_transactions (id, appointment_id, referrer_creative_id, receiver_creative_id, commission_type, commission_percentage, booking_amount, commission_amount, client_email, status, created_at, paid_at)
VALUES
  -- Dave Murphy's bookings
  ('21000001-de00-0001-0001-000000000001', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', 'finders_fee', 1.00, 45.00, 0.45, 'demo.client1@email.com', 'paid', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('21000001-de00-0001-0001-000000000002', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', 'finders_fee', 1.00, 35.00, 0.35, 'demo.client2@email.com', 'paid', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('21000001-de00-0001-0001-000000000003', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', 'finders_fee', 1.00, 50.00, 0.50, 'demo.client3@email.com', 'paid', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
  ('21000001-de00-0001-0001-000000000004', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', 'finders_fee', 1.00, 40.00, 0.40, 'demo.client4@email.com', 'paid', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
  -- Sarah Kelly's bookings
  ('21000001-de00-0001-0001-000000000005', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', 'finders_fee', 1.00, 38.00, 0.38, 'demo.client5@email.com', 'paid', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('21000001-de00-0001-0001-000000000006', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', 'finders_fee', 1.00, 42.00, 0.42, 'demo.client6@email.com', 'paid', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
  ('21000001-de00-0001-0001-000000000007', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', 'finders_fee', 1.00, 35.00, 0.35, 'demo.client7@email.com', 'paid', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
  ('21000001-de00-0001-0001-000000000008', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', 'finders_fee', 1.00, 48.00, 0.48, 'demo.client8@email.com', 'paid', NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
  -- Mike Collins's bookings
  ('21000001-de00-0001-0001-000000000009', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', 'finders_fee', 1.00, 55.00, 0.55, 'demo.client9@email.com', 'paid', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('21000001-de00-0001-0001-000000000010', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', 'finders_fee', 1.00, 40.00, 0.40, 'demo.client10@email.com', 'paid', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
  ('21000001-de00-0001-0001-000000000011', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', 'finders_fee', 1.00, 45.00, 0.45, 'demo.client11@email.com', 'paid', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
  ('21000001-de00-0001-0001-000000000012', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', 'finders_fee', 1.00, 38.00, 0.38, 'demo.client12@email.com', 'paid', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  -- Emma Walsh's bookings
  ('21000001-de00-0001-0001-000000000013', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', 'finders_fee', 1.00, 42.00, 0.42, 'demo.client13@email.com', 'paid', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('21000001-de00-0001-0001-000000000014', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', 'finders_fee', 1.00, 36.00, 0.36, 'demo.client14@email.com', 'paid', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('21000001-de00-0001-0001-000000000015', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', 'finders_fee', 1.00, 48.00, 0.48, 'demo.client15@email.com', 'paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('21000001-de00-0001-0001-000000000016', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', 'finders_fee', 1.00, 40.00, 0.40, 'demo.client16@email.com', 'paid', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),
  -- Tom Brennan's bookings
  ('21000001-de00-0001-0001-000000000017', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', 'finders_fee', 1.00, 52.00, 0.52, 'demo.client17@email.com', 'paid', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('21000001-de00-0001-0001-000000000018', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', 'finders_fee', 1.00, 45.00, 0.45, 'demo.client18@email.com', 'paid', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  ('21000001-de00-0001-0001-000000000019', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', 'finders_fee', 1.00, 38.00, 0.38, 'demo.client19@email.com', 'paid', NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),
  ('21000001-de00-0001-0001-000000000020', '633abc1d-2251-44bf-b20e-41ff5fc3d7c0', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', 'finders_fee', 1.00, 50.00, 0.50, 'demo.client20@email.com', 'paid', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days');

-- Create c2c_revenue_share records (~€10/week per pro = ~€40 per pro over 4 weeks)
INSERT INTO c2c_revenue_share (id, inviter_creative_id, invited_creative_id, referral_transaction_id, share_percentage, share_amount, status, created_at, paid_at)
VALUES
  -- Dave Murphy: €40 total
  ('31000001-de00-0001-0001-000000000001', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', '21000001-de00-0001-0001-000000000001', 1.00, 10.50, 'paid', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('31000001-de00-0001-0001-000000000002', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', '21000001-de00-0001-0001-000000000002', 1.00, 9.80, 'paid', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('31000001-de00-0001-0001-000000000003', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', '21000001-de00-0001-0001-000000000003', 1.00, 11.20, 'paid', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
  ('31000001-de00-0001-0001-000000000004', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000001', '21000001-de00-0001-0001-000000000004', 1.00, 8.50, 'paid', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
  -- Sarah Kelly: €38 total
  ('31000001-de00-0001-0001-000000000005', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', '21000001-de00-0001-0001-000000000005', 1.00, 9.50, 'paid', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('31000001-de00-0001-0001-000000000006', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', '21000001-de00-0001-0001-000000000006', 1.00, 10.20, 'paid', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
  ('31000001-de00-0001-0001-000000000007', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', '21000001-de00-0001-0001-000000000007', 1.00, 8.80, 'paid', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
  ('31000001-de00-0001-0001-000000000008', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000002', '21000001-de00-0001-0001-000000000008', 1.00, 9.50, 'paid', NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
  -- Mike Collins: €42 total
  ('31000001-de00-0001-0001-000000000009', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', '21000001-de00-0001-0001-000000000009', 1.00, 12.00, 'paid', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('31000001-de00-0001-0001-000000000010', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', '21000001-de00-0001-0001-000000000010', 1.00, 10.50, 'paid', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
  ('31000001-de00-0001-0001-000000000011', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', '21000001-de00-0001-0001-000000000011', 1.00, 9.80, 'paid', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
  ('31000001-de00-0001-0001-000000000012', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000003', '21000001-de00-0001-0001-000000000012', 1.00, 9.70, 'paid', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  -- Emma Walsh: €39 total
  ('31000001-de00-0001-0001-000000000013', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', '21000001-de00-0001-0001-000000000013', 1.00, 10.80, 'paid', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('31000001-de00-0001-0001-000000000014', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', '21000001-de00-0001-0001-000000000014', 1.00, 9.20, 'paid', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('31000001-de00-0001-0001-000000000015', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', '21000001-de00-0001-0001-000000000015', 1.00, 10.50, 'paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('31000001-de00-0001-0001-000000000016', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000004', '21000001-de00-0001-0001-000000000016', 1.00, 8.50, 'paid', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),
  -- Tom Brennan: €45 total
  ('31000001-de00-0001-0001-000000000017', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', '21000001-de00-0001-0001-000000000017', 1.00, 11.50, 'paid', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('31000001-de00-0001-0001-000000000018', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', '21000001-de00-0001-0001-000000000018', 1.00, 10.80, 'paid', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  ('31000001-de00-0001-0001-000000000019', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', '21000001-de00-0001-0001-000000000019', 1.00, 9.50, 'paid', NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),
  ('31000001-de00-0001-0001-000000000020', 'fa01571a-43f7-472b-81a6-c002130df81b', 'd1000001-de00-0001-0001-000000000005', '21000001-de00-0001-0001-000000000020', 1.00, 13.20, 'paid', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days');