-- Separate database used by the API integration test suite.
CREATE DATABASE referloop_test OWNER referloop;
-- Separate database used by the Playwright end-to-end suite (reset and seeded on every run).
CREATE DATABASE referloop_e2e OWNER referloop;
