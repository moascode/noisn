FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* variables are baked at build time by Vite — pass them as build args
ARG VITE_BROKER_WS_URL=ws://localhost:3001
ENV VITE_BROKER_WS_URL=$VITE_BROKER_WS_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
