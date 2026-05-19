FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy app source
COPY . .

# Generate prisma client (assumes DATABASE_URL provided at build or runtime)
RUN npx prisma generate || true

EXPOSE 4000
CMD ["npm", "start"]