# uzLoads TMS — Production Ready

Full-stack Trucking TMS: FastAPI + PostgreSQL + React + TypeScript

---

## Tech Stack
- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, ReportLab, openpyxl
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Database:** PostgreSQL (20 tables, fully normalized)
- **Deploy:** Render.com (backend Web Service + frontend Static Site + PostgreSQL)

---

## Database Schema (20 tables)

| Table | Description |
|-------|-------------|
| drivers | Drivers with pay rates |
| trucks | Truck fleet |
| trailers | Trailer fleet |
| brokers | Freight brokers with factoring info |
| dispatchers | Dispatchers |
| loads | Main loads table |
| load_stops | Pickup/delivery stops per load |
| load_services | Lumper, Detention, Other services |
| load_documents | Uploaded files (BOL, Confirmation) |
| load_history | Audit log per load |
| load_notes | Notes per load |
| settlements | Driver payroll settlements |
| settlement_items | Load items in settlement |
| settlement_payments | Payments against settlement |

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env → set DATABASE_URL

# Create database
createdb trucking_tms             # or use pgAdmin

# Run migrations (creates all tables)
alembic upgrade head

# Seed sample data (12 real US loads, Uzbek drivers)
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env → VITE_API_BASE_URL=http://localhost:8000
npm run dev
# App: http://localhost:5173
```

---

## Render.com Deploy (Production)

### Step 1 — PostgreSQL Database
- Render Dashboard → New → **PostgreSQL**
- Name: `uzloadstms-db`  Plan: Free
- Copy the **Internal Database URL** (starts with `postgresql://`)

### Step 2 — Backend Web Service
- New → **Web Service** → connect GitHub repo
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables:**
  ```
  DATABASE_URL  = [Internal DB URL from Step 1]
  SECRET_KEY    = [generate: python -c "import secrets; print(secrets.token_hex(32))"]
  UPLOAD_DIR    = ./uploads
  ```
- After first deploy → **Shell tab** → run:
  ```bash
  alembic upgrade head
  python seed.py
  ```
- Copy your backend URL: `https://uzloadstms.onrender.com`

### Step 3 — Frontend Static Site
- New → **Static Site** → connect GitHub repo
- **Root Directory:** `frontend`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:**
  ```
  VITE_API_BASE_URL = https://uzloadstms.onrender.com
  ```
- The `public/_redirects` file handles SPA routing (no 404 on refresh)

---

## Features

### Loads
- Full dispatch table with inline filters
- Period selector + **Custom Date Range**
- Total revenue progress bar
- Advanced filter drawer
- Edit Load modal: Services, Documents, Billing, History tabs
- New Load inline form with attachments
- PDF invoice generation (matching sample design)

### Driver Payroll
- Settlement creation with auto-attached loads
- Addition/Deduction per settlement
- New Payment / Create Carryover
- Export to QuickBooks (placeholder)

### Reports (8 types, all with PDF + Excel export)
- Total Revenue
- Rate per Mile
- Revenue by Dispatcher
- Driver Payments Summary
- Expenses
- Gross Profit
- Gross Profit per Load
- Profit & Loss

### Drivers
- Full driver profile modal
- Photo upload
- Pay rates: Per Mile / Freight % / Flatpay / Hourly
- Document sections (Application, CDL, Medical, Drug Test, MVR, SSN, Employment, Other)

---

## API Endpoints
- Swagger: `https://your-backend.onrender.com/docs`
- Health: `https://your-backend.onrender.com/health`

### Key endpoints
```
GET  /api/v1/loads                    List loads (filters, pagination)
POST /api/v1/loads                    Create load
GET  /api/v1/loads/{id}               Load detail
PUT  /api/v1/loads/{id}               Update load
GET  /api/v1/loads/{id}/invoice/pdf   Download invoice PDF
GET  /api/v1/reports/total-revenue/pdf    Download PDF
GET  /api/v1/reports/total-revenue/xlsx   Download Excel
... (all 8 report types)
```

---

## Seed Data
12 realistic US loads with Uzbek drivers:
- **Drivers:** Shohjahon Bobakulov, Xumotyun Baxriddinov, Jasur Toshmatov, Bobur Yusupov, Dilshod Nazarov
- **Routes:** Dallas→Atlanta, Miami→Philadelphia, Chicago→Phoenix, Seattle→SF, Houston→New Orleans, etc.
- **Brokers:** Global Freight LLC, Coyote Logistics, XPO Logistics, Echo Global, FastLane, National Transport
- **Statuses:** All status types represented
