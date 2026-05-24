FROM node:20-alpine

# Install Python (for your .py files)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy all files
COPY . .

# Install Node.js dependencies (dotenv + anything else you add later)
RUN npm install --production

# Expose port (Render uses PORT env variable)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
