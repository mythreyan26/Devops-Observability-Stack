# Step 1: Use official lightweight Node.js 20 Alpine Linux image
FROM node:20-alpine

# Step 2: Set working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package dependency definitions
COPY package*.json ./

# Step 4: Install production dependencies
RUN npm install --omit=dev

# Step 5: Copy application source code
COPY . .

# Step 6: Expose port 3000 to the container network
EXPOSE 3000

# Step 7: Specify the command to start the application with tracing pre-loaded
CMD ["node", "-r", "./tracing.js", "server.js"]
