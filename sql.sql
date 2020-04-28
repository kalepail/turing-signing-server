select * from contracts

delete from contracts

drop table contracts

CREATE TABLE contracts(
	contract VARCHAR(56) PRIMARY KEY UNIQUE NOT NULL,
	signer VARCHAR(56) UNIQUE NOT NULL
)