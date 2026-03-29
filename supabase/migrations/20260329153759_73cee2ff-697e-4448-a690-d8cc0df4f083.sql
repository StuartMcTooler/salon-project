UPDATE staff_members 
SET stripe_connect_account_id = NULL, 
    stripe_connect_status = 'not_started' 
WHERE id = '4d7ed8c3-a0eb-4315-a9ba-1bc9df4837e9' 
  AND stripe_connect_status = 'pending';