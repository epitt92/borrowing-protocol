ALTER TABLE IF EXISTS chain1.blocks
    ADD COLUMN IF NOT EXISTS block_time bigint;
UPDATE chain1.blocks SET block_time = substring(data->'block'->>'timestamp', 2)::bit(32)::int8;

CREATE INDEX IF NOT EXISTS block_timestamp ON chain1.blocks(block_time);

CREATE OR REPLACE FUNCTION set_block_time()
	RETURNS TRIGGER
	LANGUAGE PLPGSQL
AS
$$
DECLARE
	block_time int8;
BEGIN
	block_time = substring(NEW.data->'block'->>'timestamp', 2)::bit(32)::int8;
	NEW.block_time :=  block_time;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_block_time_int on chain1.blocks;
CREATE TRIGGER set_block_time_int
	BEFORE INSERT
	ON chain1.blocks
	FOR EACH ROW
EXECUTE PROCEDURE set_block_time();