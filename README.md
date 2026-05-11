# API Key Dashboard

A simple dashboard for managing API keys, quotas, and provisioning.

---

## Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd api-key-dashboard
npm install
```

Start the development server:

```bash
npm run dev
```

---

## Backend Setup

Run the backend provisioning server:

```bash
python provisioner.py --serve
```

---

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

## .env
```

REDIS_PASSWORD=
REDIS_PORT=
REDIS_HOST=
```
