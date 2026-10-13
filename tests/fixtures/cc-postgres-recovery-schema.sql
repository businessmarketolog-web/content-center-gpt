-- Synthetic-only offline PostgreSQL 17 recovery fixture; never production schema.
CREATE SCHEMA cc_fixture;
CREATE TABLE cc_fixture.clients (
  id uuid PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE cc_fixture.content_items (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES cc_fixture.clients(id),
  title text NOT NULL,
  format text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','production','review','approved'))
);
CREATE TABLE cc_fixture.work_items (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES cc_fixture.clients(id),
  title text NOT NULL
);
CREATE INDEX cc_content_client_idx ON cc_fixture.content_items(client_id);
ALTER TABLE cc_fixture.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_fixture.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_fixture.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_client_select ON cc_fixture.clients
  FOR SELECT TO cc_fixture_reader
  USING (id = NULLIF(current_setting('cc.client_id',true),'')::uuid);
CREATE POLICY cc_content_select ON cc_fixture.content_items
  FOR SELECT TO cc_fixture_reader
  USING (client_id = NULLIF(current_setting('cc.client_id',true),'')::uuid);
CREATE POLICY cc_work_select ON cc_fixture.work_items
  FOR SELECT TO cc_fixture_reader
  USING (client_id = NULLIF(current_setting('cc.client_id',true),'')::uuid);
