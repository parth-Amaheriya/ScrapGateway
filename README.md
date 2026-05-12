
## Requirements

### Frontend
- Node.js
- npm

### Backend
- Python 3.10+

---

## Development

Run frontend and backend in separate terminals.

### Frontend
```bash
cd api-key-dashboard
npm run dev
```

### Backend
```bash
python provisioner.py --serve
```

---

## Project Structure

```text
api-key-dashboard/
├── api-key-dashboard/   # Frontend (Vite + React)
├── provisioner.py       # Backend server
└── README.md
```

## for backend .env
```

REDIS_PASSWORD=
REDIS_PORT=
REDIS_HOST=

MONGODB_URI=
ADMIN_JWT_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=

HOST=
PORT=

```

## for Frontend .env
```
VITE_API_BASE_URL=http://localhost:8000/api
```
