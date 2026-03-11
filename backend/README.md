# Studiovyn Leads Backend

## Outreach System Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in values.
2. Start API server:

```bash
npm run dev
```

3. Start the message queue worker in a separate terminal:

```bash
npm run worker
```

## Key Endpoints

- `POST /api/campaigns` -> create campaign
- `POST /api/campaigns/:id/leads` -> attach leads
- `POST /api/campaigns/:id/start` -> enqueue outreach messages

## Notes

- WhatsApp Web requires scanning the QR code shown in the worker logs.
- Redis is required for the queue system.
- Generated images are stored in `backend/generated-assets` by default.
