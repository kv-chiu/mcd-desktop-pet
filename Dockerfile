# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Production stage
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/

EXPOSE 80
