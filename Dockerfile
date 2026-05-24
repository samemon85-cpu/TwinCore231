FROM node:20-alpine

# Install Python (for your model_manager.py and test_predict.py)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    musl-dev \
    python3-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy everything from your repo
COPY . .

# Expose the port Render expects
EXPOSE 3000

# Start your Node.js server
CMD ["node", "server.js"]
