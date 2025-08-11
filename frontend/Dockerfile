# --- Build Stage ---
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the production assets
RUN npm run build

# --- Production Stage ---
FROM nginx:1.23-alpine
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy static assets from the build stage
COPY --from=build /app/build .

# Nginx will listen on port 80 by default.
# The container needs to be started for nginx to run.
# The default nginx command is already configured to start the server.
