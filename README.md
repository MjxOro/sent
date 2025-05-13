# Sent - Real-time Chat Application 💬 ✨

## 🛠️ Tech Stack

This project uses the following technologies:

### Frontend 🖥️

- Next.js (React)
- TypeScript
- Zustand for state management
- Framer Motion for animations
- Tailwind CSS for styling

### Backend 🚀

- Go (Golang)
- Gin web framework
- WebSockets for real-time communication
- JWT for authentication

### Database & Storage 💾

- PostgreSQL for persistent data
- Redis for caching and pub/sub messaging

## 🚀 Development Setup

Follow these steps to set up your development environment:

### Prerequisites 📋

- Docker and Docker Compose 🐳
- Node.js (v16 or higher) 📦
- Go (v1.19 or higher) 🐹

### Steps 👣

1. **Clone the repository** 📂

```bash
git clone https://github.com/your-username/sent.git
cd sent
```

2. **Set up environment variables** 🔑

```bash
cp env.example .env
```

Edit `.env` file with your configurations. Make sure to update OAuth credentials!

3. **Start development environment with Docker** 🐳

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will start:

- Frontend at http://localhost:3000 🌐
- Backend at http://localhost:8080 🚀
- PostgreSQL at localhost:5432 🐘
- Redis at localhost:6379 🔄

4. **Initialize the database** 💽

The migrations will run automatically, but if you need to run them manually:

```bash
docker-compose exec backend go run scripts/migrations/run.go
```

5. **Start coding!** 💻

- Frontend code is in `client/` directory
- Backend code is in `server/` directory

Hot reload is enabled for both frontend and backend in development mode. ♨️

## 🌍 Production Setup

Follow these steps to deploy to production:

### Prerequisites 📋

- Docker and Docker Compose 🐳
- Domain name with DNS configured 🌐
- SSL certificate (Caddy will handle this automatically) 🔒

### Steps 👣

1. **Clone the repository on your server** 📂

```bash
git clone https://github.com/your-username/sent.git
cd sent
```

2. **Set up environment variables for production** 🔑

```bash
cp env.example .env
```

Edit `.env` file with production values:

- Set `NODE_ENV=production`
- Set `GO_ENV=production`
- Update `FRONTEND_URI` and `SERVER_URI` with your domain
- Set `COOKIE_DOMAIN` to your domain
- Set `COOKIE_SECURE=true`
- Add proper OAuth credentials
- Set strong database passwords

3. **Configure Caddy** 🚦

```bash
cp Caddyfile.example Caddyfile
```

Edit `Caddyfile` to use your domain names:

```
your.domain.com {
    reverse_proxy frontend:{$PORT_FRONTEND}
}

api.your.domain.com {
    reverse_proxy backend:{$PORT_BACKEND}
}
```

4. **Start the production environment** 🚀

```bash
docker-compose -f docker-compose.prod.yml up -d
```

5. **Monitor logs** 📊

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## 🛠️ Maintenance

Remember to back up your database regularly:

```bash
docker-compose exec postgres pg_dump -U postgres chatapp > backup.sql
```

## ❓ Troubleshooting

If WebSocket connections fail, check:

- Frontend environment variables for WebSocket URL 🌐
- Network/firewall settings 🧱
- Proper SSL configuration (WebSocket requires secure connection in production) 🔒

---

Enjoy using this chat application! If you have any questions, feel free to create an issue on GitHub. 👋
