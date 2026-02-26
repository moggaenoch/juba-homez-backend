# JubaHomez API (Node/Express + MySQL)

This is a ready-to-run REST API for the Juba Homez web application with:
- Auth (JWT) + role-based access control
- Properties (search/filter) + approvals
- Inquiries + replies
- Viewings (requests + schedule + calendar)
- Photography jobs (open/accept/reject/schedule/messages)
- Media uploads (multer + image thumbnails using sharp) + admin approvals
- Notifications + audit logs
- Analytics events + basic metrics

## 1) Install
```bash
npm install
cp .env.example .env
```

## 2) Create DB + Tables
```bash
mysql -u root -p < src/sql/schema.sql
```

## 3) Run
```bash
npm run dev
# or
npm start
```

## Notes
- GitHub Pages cannot run Node/Express. Host this API on Render/Railway/Fly/VPS.
- Uploads are stored locally in `/uploads` and served at `/uploads/<file>`.
- For production: replace local uploads with S3/Cloud storage and restrict CORS.
