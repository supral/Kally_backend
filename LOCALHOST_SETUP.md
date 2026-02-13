# Local development (localhost)

Everything runs on **localhost**.

## URLs

| Service   | URL                    |
|----------|------------------------|
| Backend  | http://localhost:5000  |
| Frontend | http://localhost:5173  |
| MongoDB  | mongodb://localhost:27017/mbm |

## 1. Backend

```bash
cd backend
npm install
# Ensure MongoDB is running locally (e.g. MongoDB Compass connected to localhost:27017)
npm run dev
```

- Server: **http://localhost:5000**
- Health: http://localhost:5000/api/health
- API base: http://localhost:5000/api

## 2. Frontend

```bash
cd frontend/crm-branches-frontend
npm install
npm run dev
```

- App: **http://localhost:5173**
- API requests go to **http://localhost:5000** (see `VITE_API_URL` in `.env.development`)

## 3. Environment

**Backend (backend/.env)**

- `PORT=5000`
- `HOST=localhost`
- `MONGO_URI=mongodb://localhost:27017/mbm`

**Frontend (frontend/crm-branches-frontend/.env.development)**

- `VITE_API_URL=http://localhost:5000`

## 4. Admin user & lead statuses

```bash
cd backend
npm run seed
```

Seeds the default admin user.

To seed **default lead statuses** (New, Contacted, Call not Connected, Follow up, Booked, Lost):

```bash
node seeders/seedLeadStatuses.js
```

Login: **admin@lishnutech.com** / **admin123** at http://localhost:5173/login (Kally Threading – Multi-Branch CRM)
