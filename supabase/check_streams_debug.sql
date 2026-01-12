SELECT * FROM icepulse_streams ORDER BY created_at DESC LIMIT 5;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'icepulse_streams';
