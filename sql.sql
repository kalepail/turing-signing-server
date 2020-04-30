select * from contracts

delete from contracts

drop table contracts

CREATE TABLE contracts(
	contract VARCHAR(56) PRIMARY KEY UNIQUE NOT NULL,
	signer VARCHAR(56) UNIQUE NOT NULL,
	pendingTxns VARCHAR(64)[] DEFAULT NULL,
	nextDedupe BIGINT DEFAULT (extract(epoch from now()) * 1000 + 60000) NOT NULL, -- In 1 minute
	nextFlush BIGINT DEFAULT (extract(epoch from now()) * 1000 + 3600000) NOT NULL -- In 1 hour
)

ALTER TABLE contracts
ADD COLUMN pendingTxns VARCHAR(64)[] DEFAULT NULL,
ADD COLUMN nextDedupe BIGINT DEFAULT (extract(epoch from now()) * 1000 + 60000) NOT NULL, -- In 1 minute
ADD COLUMN nextFlush BIGINT DEFAULT (extract(epoch from now()) * 1000 + 3600000) NOT NULL -- In 1 hour

INSERT INTO contracts (contract, signer)
select 'GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR', 'SDRJWX2SNJTMFFGGGO4DQXL7X5SHVENZLYX6K7LCZQSIJ6XSEMTCXLHY'