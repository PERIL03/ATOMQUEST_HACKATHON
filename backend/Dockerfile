FROM node:20-bullseye-slim
WORKDIR /app

# Ensure OpenSSL is available for Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	openssl \
	&& rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy app source
COPY . .

# Generate prisma client (assumes DATABASE_URL provided at build or runtime)
RUN npx prisma generate

EXPOSE 4000
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]