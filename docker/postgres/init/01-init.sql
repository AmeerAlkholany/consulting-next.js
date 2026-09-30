-- Runs once, when the container initializes an empty data directory.
--
-- `consulting` is created by the image from POSTGRES_DB. The database test
-- suites need their own database so that truncating tables between suites can
-- never touch development data: they read TEST_DATABASE_URL.
--
-- The `btree_gist` extension is NOT created here. Migrations own the schema,
-- including extensions, so that `prisma migrate deploy` reproduces an identical
-- database everywhere (ARCHITECTURE.md §8.2).

CREATE DATABASE consulting_test OWNER postgres;
