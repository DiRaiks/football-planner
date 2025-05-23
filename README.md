# football-planner

## Development using Docker Compose

1. Create a `.env` file with the environment variables required by the server.
   To enable HTTPS, place `privkey.pem` and `fullchain.pem` inside a `certs/`
   directory in the project root. The compose configuration will mount these
   files and set the appropriate environment variables automatically.
2. Run `docker compose up --build` to build and start the server container.

## Running tests

Execute `npm test` from the project root to run the server test suite.
