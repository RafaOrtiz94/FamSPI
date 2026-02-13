const db = require('./backend/src/config/db');
(async () => {
  try {
    const total = await db.query("SELECT COUNT(*) AS total FROM private_purchase_requests WHERE offer_kind = 'comodato';");
    console.log('total', total.rows[0]);
    const status = await db.query("SELECT status, COUNT(*) AS cnt FROM private_purchase_requests WHERE offer_kind = 'comodato' GROUP BY status ORDER BY cnt DESC;");
    console.log('status distribution', status.rows);
    const recent = await db.query("SELECT id, status, business_case_id, provider_response_at, created_at FROM private_purchase_requests WHERE offer_kind = 'comodato' ORDER BY created_at DESC LIMIT 5;");
    console.log('recent', recent.rows);
  } catch (err) {
    console.error('db error', err);
  } finally {
    process.exit();
  }
})();
