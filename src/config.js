const prod = process.env.NODE_ENV === 'production';
if (prod && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET es obligatorio en producción');
const path = require('path');
module.exports = {
  uploads: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
  port: +process.env.PORT || 3000,
  db: process.env.DATABASE_URL,
  secret: process.env.SESSION_SECRET || 'solo-desarrollo',
  secure: process.env.COOKIE_SECURE === 'true',
  n8n: { url: process.env.N8N_WEBHOOK_URL || '', key: process.env.N8N_API_KEY || '' }
};
