const db = require('../../config/db');
const logger = require('../../config/logger');
const { logAction } = require('../../utils/audit');
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;

async function listInventory(req, res) {
  try {
    const q = await db.query('SELECT * FROM inventory ORDER BY name');
    res.json(q.rows);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error listing inventory' });
  }
}

async function moveInventory(req, res) {
  const { inventory_id, type, quantity, reason } = req.body;
  const userId = req.user.id;
  if (!['in','out'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (quantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });

  try {
    const inv = (await db.query('SELECT * FROM inventory WHERE id=$1', [inventory_id])).rows[0];
    if (!inv) return res.status(404).json({ error: 'Inventory not found' });

    const newQty = type === 'in' ? inv.quantity + quantity : inv.quantity - quantity;
    if (newQty < 0) return res.status(400).json({ error: 'Insufficient stock' });

    // transaction
    await db.query('BEGIN');
    await db.query('UPDATE inventory SET quantity=$1, last_updated=now() WHERE id=$2', [newQty, inventory_id]);
    const mv = (await db.query(
      `INSERT INTO inventory_movements (inventory_id, type, quantity, reason, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [inventory_id, type, quantity, reason, userId]
    )).rows[0];

    // sync with Silver (example HTTP API)
    try {
      const resSilver = await axios.post(`${process.env.SILVER_API_URL}/inventory_movements`, {
        inventory_id, type, quantity, reason, local_tx_id: mv.id
      }, { headers: { 'x-api-key': process.env.SILVER_API_KEY }});
      const silverTxId = resSilver.data.id;
      await db.query('UPDATE inventory_movements SET silver_tx_id=$1 WHERE id=$2', [silverTxId, mv.id]);
    } catch (err) {
      logger.warn('Silver sync failed, will reconcile later: %o', err);
    }

    await db.query('COMMIT');

    await logAction(userId, 'inventory_move', { inventory_id, type, quantity });
    res.json({ movement: mv });
  } catch (err) {
    await db.query('ROLLBACK');
    logger.error(err);
    res.status(500).json({ error: 'Error moving inventory' });
  }
}

async function report(req, res) {
  try {
    const rows = (await db.query('SELECT im.*, i.name as inventory_name FROM inventory_movements im JOIN inventory i ON im.inventory_id=i.id ORDER BY im.created_at DESC')).rows;
    const csvStringifier = createCsvWriter({
      header: [
        {id:'id', title:'ID'},
        {id:'inventory_name', title:'Item'},
        {id:'type', title:'Type'},
        {id:'quantity', title:'Quantity'},
        {id:'reason', title:'Reason'},
        {id:'created_at', title:'CreatedAt'},
        {id:'silver_tx_id', title:'SilverTxId'}
      ]
    });
    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
    res.attachment('inventory_report.csv');
    res.send(csv);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error generating report' });
  }
}

async function syncWithSilver(req, res) {
  try {
    // fetch local and remote and compare. Here simplified:
    const local = (await db.query('SELECT * FROM inventory')).rows;
    const remoteRes = await axios.get(`${process.env.SILVER_API_URL}/inventory`, { headers: { 'x-api-key': process.env.SILVER_API_KEY }});
    const remote = remoteRes.data;
    // build discrepancies
    const mapRemote = new Map(remote.map(r => [r.sku, r]));
    const discrepancies = [];
    for (const l of local) {
      const r = mapRemote.get(l.sku);
      if (!r) { discrepancies.push({ sku: l.sku, local: l.quantity, remote: null }); continue; }
      if (r.quantity !== l.quantity) discrepancies.push({ sku: l.sku, local: l.quantity, remote: r.quantity });
    }
    res.json({ discrepancies });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Error syncing' });
  }
}

module.exports = { listInventory, moveInventory, report, syncWithSilver };
