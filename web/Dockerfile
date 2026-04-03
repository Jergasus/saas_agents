# Stage 1: Build Angular App + Widget
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

# Build the main Angular app and the embeddable widget
RUN npm run build -- --configuration production && npm run build:widget

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built Angular app
COPY --from=builder /usr/src/app/dist/web/browser /usr/share/nginx/html

# Copy built widget bundle
COPY --from=builder /usr/src/app/dist/widget/browser/main.js /usr/share/nginx/html/widget/widget.js

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
