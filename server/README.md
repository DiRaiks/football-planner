# server

## HTTPS support

Set environment variables `HTTPS_PRIVKEY_PATH` and `HTTPS_FULLCHAIN_PATH` to
enable HTTPS. They must contain paths to `privkey.pem` and `fullchain.pem`
certificates which will be loaded during server startup.

## Running tests

Tests are written with the built-in Node.js runner. Run them with:

```bash
npm test
```

## Development

Run the development server with:

```bash
npm run dev
```

The command includes `NODE_OPTIONS=--openssl-legacy-provider` so it works on
Node.js versions that require the legacy OpenSSL provider.
