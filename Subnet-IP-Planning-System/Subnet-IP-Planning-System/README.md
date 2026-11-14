# Subnet & IP Address Planning Validation System
React + Vite frontend, Express REST backend, MongoDB (Mongoose). Subjects: CN, FSWD, FLAT.

## Run locally
```bash
cd backend && cp .env.example .env && npm install && npm start      # http://localhost:5000
cd frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
cd backend && npm test                                              # unit + API tests
```
If `MONGODB_URI` is empty the backend uses an **in-memory fallback** (data resets on restart; a warning is logged).

## MongoDB Atlas
1. Create a free cluster, a database user, and allow network access (0.0.0.0/0 for Render).
2. Copy the connection string into `MONGODB_URI` (add the DB name `subnet_planner`).

## GitHub
```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main && git remote add origin https://github.com/<you>/Subnet-IP-Planning-System.git && git push -u origin main
```

## Deploy backend on Render
New Web Service -> repo -> Root Directory `backend`, Build `npm install`, Start `npm start`.
Env vars: `MONGODB_URI`, `CORS_ORIGIN=https://<your-app>.vercel.app`. (`PORT` is set by Render.) Check `/api/health`.

## Deploy frontend on Vercel
Import repo -> Root Directory `frontend`, Framework Vite, Build `npm run build`, Output `dist`.
Env var: `VITE_API_URL=https://<your-service>.onrender.com`. Redeploy after changing it.

## REST API
| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | status + storage mode |
| POST | /api/validate/ipv4 | `{type: ipv4\|mask\|cidr, value}` regex + DFA trace |
| POST | /api/subnet/calculate | `{cidr}` or `{ip, mask}` |
| POST | /api/subnet/overlap | `{subnets:[...]}` numeric range comparison |
| GET/POST | /api/configs | list / create (409 on overlap with saved config) |
| GET/PUT/DELETE | /api/configs/:id | read / update / delete |
| POST | /api/allocate | `{configId, ip?, label}` (blank ip = next free; duplicates rejected) |
| DELETE | /api/allocate/:configId/:ip | release host |
| GET/DELETE | /api/history | validation history |

## Sample tests
| Input | Expected |
|---|---|
| IPv4 `192.168.1.1` | valid |
| IPv4 `256.1.1.1` | invalid: octet value exceeds 255 |
| IPv4 `01.2.3.4` | invalid: leading zero |
| IPv4 `1.2.3` | invalid: input ended early |
| Mask `255.0.255.0` | invalid: non-contiguous |
| `192.168.1.77/26` | net 192.168.1.64, bc 192.168.1.127, hosts .65-.126, 64 total / 62 usable, mask 255.255.255.192 |
| `10.0.0.5` + `255.255.255.0` | 10.0.0.0/24 |
| `/31` / `/32` | 2 / 1 usable |
| `10.0.0.0/24`, `10.0.0.128/25`, `10.0.1.0/24` | one overlap: A contains B |
| Allocate `192.168.1.1` twice in `192.168.1.0/30` | second rejected (409) |
| Allocate `192.168.1.3` in `192.168.1.0/30` | rejected (broadcast) |

## Notes
Overlap detection compares numeric start/end addresses; regex/DFA are used only for syntax validation.
