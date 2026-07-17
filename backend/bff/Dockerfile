FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN rm -f package-lock.json && npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY backend/bff/go.mod backend/bff/go.sum ./
RUN go mod download
COPY backend/bff/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/bff

FROM alpine:3.20
COPY --from=builder /server /server
COPY --from=frontend /app/dist /static
ENTRYPOINT ["/server"]
