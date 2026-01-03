-- Step 1: Create 5 demo staff members (invited pros)
INSERT INTO staff_members (id, full_name, display_name, email, phone, is_active, tier)
VALUES
  ('de000001-de00-4000-8000-000000000001', 'Dave Murphy', 'Dave Murphy', 'demo.dave@example.com', '+353871111111', false, 'pro'),
  ('de000001-de00-4000-8000-000000000002', 'Sarah Kelly', 'Sarah Kelly', 'demo.sarah@example.com', '+353872222222', false, 'pro'),
  ('de000001-de00-4000-8000-000000000003', 'Mike Collins', 'Mike Collins', 'demo.mike@example.com', '+353873333333', false, 'pro'),
  ('de000001-de00-4000-8000-000000000004', 'Emma Walsh', 'Emma Walsh', 'demo.emma@example.com', '+353874444444', false, 'pro'),
  ('de000001-de00-4000-8000-000000000005', 'Tom Brennan', 'Tom Brennan', 'demo.tom@example.com', '+353875555555', false, 'pro');

-- Step 2: Create creative_invites for Jamie O'Brien as inviter
INSERT INTO creative_invites (id, inviter_creative_id, invite_code, invited_creative_id, signup_completed_at, tenth_booking_completed_at, bonus_qualification_met_at, upfront_bonus_paid, upfront_bonus_amount)
VALUES
  ('11000001-de00-4000-8000-000000000001', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'JOBRIEN-DEMO1', 'de000001-de00-4000-8000-000000000001', NOW() - INTERVAL '6 weeks', NOW() - INTERVAL '4 weeks', NOW() - INTERVAL '4 weeks', true, 50),
  ('11000001-de00-4000-8000-000000000002', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'JOBRIEN-DEMO2', 'de000001-de00-4000-8000-000000000002', NOW() - INTERVAL '5 weeks', NOW() - INTERVAL '3 weeks', NOW() - INTERVAL '3 weeks', true, 50),
  ('11000001-de00-4000-8000-000000000003', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'JOBRIEN-DEMO3', 'de000001-de00-4000-8000-000000000003', NOW() - INTERVAL '5 weeks', NOW() - INTERVAL '3 weeks', NOW() - INTERVAL '3 weeks', true, 50),
  ('11000001-de00-4000-8000-000000000004', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'JOBRIEN-DEMO4', 'de000001-de00-4000-8000-000000000004', NOW() - INTERVAL '4 weeks', NOW() - INTERVAL '2 weeks', NOW() - INTERVAL '2 weeks', true, 50),
  ('11000001-de00-4000-8000-000000000005', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'JOBRIEN-DEMO5', 'de000001-de00-4000-8000-000000000005', NOW() - INTERVAL '4 weeks', NOW() - INTERVAL '2 weeks', NOW() - INTERVAL '2 weeks', true, 50);

-- Step 3: Create referral_transactions using existing appointment IDs
INSERT INTO referral_transactions (id, receiver_creative_id, referrer_creative_id, appointment_id, client_email, booking_amount, commission_percentage, commission_amount, commission_type, status, created_at)
VALUES
  ('21000001-de00-4000-8000-000000000001', 'de000001-de00-4000-8000-000000000001', NULL, 'dffebee8-a91a-4f27-8198-e5422986eaeb', 'client1@demo.com', 4500, 1, 45, 'revenue_share', 'paid', NOW() - INTERVAL '2 days'),
  ('21000001-de00-4000-8000-000000000002', 'de000001-de00-4000-8000-000000000001', NULL, '603b80d9-3668-4d8d-b706-4adc7b6c4db2', 'client2@demo.com', 3500, 1, 35, 'revenue_share', 'paid', NOW() - INTERVAL '9 days'),
  ('21000001-de00-4000-8000-000000000003', 'de000001-de00-4000-8000-000000000001', NULL, '836b65a3-8e87-482e-930a-f1aefe4724cd', 'client3@demo.com', 4000, 1, 40, 'revenue_share', 'paid', NOW() - INTERVAL '16 days'),
  ('21000001-de00-4000-8000-000000000004', 'de000001-de00-4000-8000-000000000001', NULL, 'd1da27ec-b5e1-4a2c-9ed0-f427114883cd', 'client4@demo.com', 3800, 1, 38, 'revenue_share', 'paid', NOW() - INTERVAL '23 days'),
  ('21000001-de00-4000-8000-000000000005', 'de000001-de00-4000-8000-000000000002', NULL, '0f16bc4f-c8e1-41b2-81b6-6a70b1ca30c0', 'client5@demo.com', 3800, 1, 38, 'revenue_share', 'paid', NOW() - INTERVAL '3 days'),
  ('21000001-de00-4000-8000-000000000006', 'de000001-de00-4000-8000-000000000002', NULL, '721da3b3-a922-4a24-b1e6-35bcb6bd4914', 'client6@demo.com', 4200, 1, 42, 'revenue_share', 'paid', NOW() - INTERVAL '10 days'),
  ('21000001-de00-4000-8000-000000000007', 'de000001-de00-4000-8000-000000000002', NULL, '5bfff93c-b4a9-485d-b1e2-28ca3fdf7ff3', 'client7@demo.com', 3200, 1, 32, 'revenue_share', 'paid', NOW() - INTERVAL '17 days'),
  ('21000001-de00-4000-8000-000000000008', 'de000001-de00-4000-8000-000000000002', NULL, '196e060b-cc9b-4d07-aa25-622b274582d9', 'client8@demo.com', 3600, 1, 36, 'revenue_share', 'paid', NOW() - INTERVAL '24 days'),
  ('21000001-de00-4000-8000-000000000009', 'de000001-de00-4000-8000-000000000003', NULL, 'ea78ee2a-671a-4e82-9344-db446500ea3e', 'client9@demo.com', 5000, 1, 50, 'revenue_share', 'paid', NOW() - INTERVAL '5 days'),
  ('21000001-de00-4000-8000-000000000010', 'de000001-de00-4000-8000-000000000003', NULL, '9f667a79-84c1-4682-975a-63b5dd2624f1', 'client10@demo.com', 4200, 1, 42, 'revenue_share', 'paid', NOW() - INTERVAL '12 days'),
  ('21000001-de00-4000-8000-000000000011', 'de000001-de00-4000-8000-000000000003', NULL, '643bcc89-1840-4c58-b08d-eaabac2d23a9', 'client11@demo.com', 3800, 1, 38, 'revenue_share', 'paid', NOW() - INTERVAL '19 days'),
  ('21000001-de00-4000-8000-000000000012', 'de000001-de00-4000-8000-000000000003', NULL, 'db3e1fe3-41c5-4aa9-a4c6-0fc8f7261355', 'client12@demo.com', 4500, 1, 45, 'revenue_share', 'paid', NOW() - INTERVAL '26 days'),
  ('21000001-de00-4000-8000-000000000013', 'de000001-de00-4000-8000-000000000004', NULL, 'd1180710-4239-410c-9a4f-ccd610f51c1d', 'client13@demo.com', 3800, 1, 38, 'revenue_share', 'paid', NOW() - INTERVAL '1 day'),
  ('21000001-de00-4000-8000-000000000014', 'de000001-de00-4000-8000-000000000004', NULL, '45ad91bf-1c04-4c7e-a7bc-1e7900d6d888', 'client14@demo.com', 4000, 1, 40, 'revenue_share', 'paid', NOW() - INTERVAL '8 days'),
  ('21000001-de00-4000-8000-000000000015', 'de000001-de00-4000-8000-000000000004', NULL, '380a7903-adb3-464a-8c9e-4c174e66c140', 'client15@demo.com', 3500, 1, 35, 'revenue_share', 'paid', NOW() - INTERVAL '15 days'),
  ('21000001-de00-4000-8000-000000000016', 'de000001-de00-4000-8000-000000000004', NULL, 'c3a8a18b-cf0c-4501-b537-8b7931fd23cb', 'client16@demo.com', 4200, 1, 42, 'revenue_share', 'paid', NOW() - INTERVAL '22 days'),
  ('21000001-de00-4000-8000-000000000017', 'de000001-de00-4000-8000-000000000005', NULL, 'da9c042d-9ff3-4a45-ae92-8ae078cc51e6', 'client17@demo.com', 4500, 1, 45, 'revenue_share', 'paid', NOW() - INTERVAL '4 days'),
  ('21000001-de00-4000-8000-000000000018', 'de000001-de00-4000-8000-000000000005', NULL, '6030f150-254b-4631-8444-551ab13da9bd', 'client18@demo.com', 4800, 1, 48, 'revenue_share', 'paid', NOW() - INTERVAL '11 days'),
  ('21000001-de00-4000-8000-000000000019', 'de000001-de00-4000-8000-000000000005', NULL, '046bc6f3-512e-4f65-bf25-ccff30369471', 'client19@demo.com', 4000, 1, 40, 'revenue_share', 'paid', NOW() - INTERVAL '18 days'),
  ('21000001-de00-4000-8000-000000000020', 'de000001-de00-4000-8000-000000000005', NULL, '86d93972-33f8-43c9-9854-9b5b7040d291', 'client20@demo.com', 3800, 1, 38, 'revenue_share', 'paid', NOW() - INTERVAL '25 days');

-- Step 4: Create c2c_revenue_share records (Jamie O'Brien earns 1% from each)
INSERT INTO c2c_revenue_share (id, inviter_creative_id, invited_creative_id, referral_transaction_id, share_amount, share_percentage, status, paid_at, created_at)
VALUES
  ('31000001-de00-4000-8000-000000000001', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000001', '21000001-de00-4000-8000-000000000001', 45, 1, 'paid', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'),
  ('31000001-de00-4000-8000-000000000002', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000001', '21000001-de00-4000-8000-000000000002', 35, 1, 'paid', NOW() - INTERVAL '8 days', NOW() - INTERVAL '9 days'),
  ('31000001-de00-4000-8000-000000000003', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000001', '21000001-de00-4000-8000-000000000003', 40, 1, 'paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days'),
  ('31000001-de00-4000-8000-000000000004', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000001', '21000001-de00-4000-8000-000000000004', 38, 1, 'paid', NOW() - INTERVAL '22 days', NOW() - INTERVAL '23 days'),
  ('31000001-de00-4000-8000-000000000005', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000002', '21000001-de00-4000-8000-000000000005', 38, 1, 'paid', NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 days'),
  ('31000001-de00-4000-8000-000000000006', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000002', '21000001-de00-4000-8000-000000000006', 42, 1, 'paid', NOW() - INTERVAL '9 days', NOW() - INTERVAL '10 days'),
  ('31000001-de00-4000-8000-000000000007', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000002', '21000001-de00-4000-8000-000000000007', 32, 1, 'paid', NOW() - INTERVAL '16 days', NOW() - INTERVAL '17 days'),
  ('31000001-de00-4000-8000-000000000008', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000002', '21000001-de00-4000-8000-000000000008', 36, 1, 'paid', NOW() - INTERVAL '23 days', NOW() - INTERVAL '24 days'),
  ('31000001-de00-4000-8000-000000000009', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000003', '21000001-de00-4000-8000-000000000009', 50, 1, 'paid', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days'),
  ('31000001-de00-4000-8000-000000000010', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000003', '21000001-de00-4000-8000-000000000010', 42, 1, 'paid', NOW() - INTERVAL '11 days', NOW() - INTERVAL '12 days'),
  ('31000001-de00-4000-8000-000000000011', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000003', '21000001-de00-4000-8000-000000000011', 38, 1, 'paid', NOW() - INTERVAL '18 days', NOW() - INTERVAL '19 days'),
  ('31000001-de00-4000-8000-000000000012', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000003', '21000001-de00-4000-8000-000000000012', 45, 1, 'paid', NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days'),
  ('31000001-de00-4000-8000-000000000013', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000004', '21000001-de00-4000-8000-000000000013', 38, 1, 'paid', NOW(), NOW() - INTERVAL '1 day'),
  ('31000001-de00-4000-8000-000000000014', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000004', '21000001-de00-4000-8000-000000000014', 40, 1, 'paid', NOW() - INTERVAL '7 days', NOW() - INTERVAL '8 days'),
  ('31000001-de00-4000-8000-000000000015', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000004', '21000001-de00-4000-8000-000000000015', 35, 1, 'paid', NOW() - INTERVAL '14 days', NOW() - INTERVAL '15 days'),
  ('31000001-de00-4000-8000-000000000016', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000004', '21000001-de00-4000-8000-000000000016', 42, 1, 'paid', NOW() - INTERVAL '21 days', NOW() - INTERVAL '22 days'),
  ('31000001-de00-4000-8000-000000000017', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000005', '21000001-de00-4000-8000-000000000017', 45, 1, 'paid', NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days'),
  ('31000001-de00-4000-8000-000000000018', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000005', '21000001-de00-4000-8000-000000000018', 48, 1, 'paid', NOW() - INTERVAL '10 days', NOW() - INTERVAL '11 days'),
  ('31000001-de00-4000-8000-000000000019', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000005', '21000001-de00-4000-8000-000000000019', 40, 1, 'paid', NOW() - INTERVAL '17 days', NOW() - INTERVAL '18 days'),
  ('31000001-de00-4000-8000-000000000020', '2b2a223a-2bfd-454a-8453-268ca6a42b63', 'de000001-de00-4000-8000-000000000005', '21000001-de00-4000-8000-000000000020', 38, 1, 'paid', NOW() - INTERVAL '24 days', NOW() - INTERVAL '25 days');