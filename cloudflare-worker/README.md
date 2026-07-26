# KIDmath API deployment

This Worker provides authentication and user statistics for the static
KIDmath site hosted at `https://aur-math.github.io`.

1. Sign in to Cloudflare from Wrangler:

   ```bash
   npm install
   npx wrangler login
   ```

2. Create the free D1 database:

   ```bash
   npx wrangler d1 create kidmath-users
   ```

3. Copy the returned database ID into `wrangler.jsonc`.

4. Create the tables:

   ```bash
   npm run db:remote
   ```

5. Store the initial administrator password as a secret:

   ```bash
   npx wrangler secret put INITIAL_ADMIN_PASSWORD
   ```

6. Deploy:

   ```bash
   npm run deploy
   ```

7. Put the Worker URL in the root `config.js`:

   ```js
   window.KIDMATH_API_URL = "https://kidmath-api.aur-math.workers.dev";
   ```

The first successful login with username `admin` and the configured secret
creates the administrator account. Passwords are stored only as salted PBKDF2
hashes.

## Deploy the site at aurtech.ca/kidmath

The site build copies the root frontend files into the subdirectory structure
required by Cloudflare Workers Static Assets.

```bash
npm run deploy:site
```
