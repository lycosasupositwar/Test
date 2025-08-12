# --- Build Stage ---
FROM node:18-alpine AS build
ARG REACT_APP_API_URL
WORKDIR /app

COPY package.json ./
# We removed package-lock.json to fix a build issue in the sandbox
# COPY package-lock.json ./
RUN npm install

COPY . .
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# --- Production Stage ---
FROM nginx:1.23-alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /app/build .
