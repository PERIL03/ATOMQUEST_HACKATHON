#!/bin/sh
set -e

npx prisma migrate deploy
node prisma/seed-prod.js
npm start
