// runs before any backend module is imported, so config picks these up.
// dotenv never overrides variables that are already set, which keeps the
// real .env database and api keys out of the tests
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret';
process.env.GEMINI_API_KEY = '';
process.env.VITE_GEMINI_API_KEY = '';
process.env.ADMIN_EMAILS = '';
// without a test database the api tests are skipped, and the pool points
// somewhere that can't be reached rather than at the real DATABASE_URL
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://nobody@127.0.0.1:1/none';
