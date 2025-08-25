// charges.js (your original with fixes)
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const queue = require('../utils/queue');
const { validateCharge, validateMetadata } = require('../utils/validation');  // Assume you have this

const router = express.Router();

/**
 * @swagger
 * /v1/charges:
 *   post:
 *     summary: Create a charge
 *     description: Initiates a payment.
 *     tags: [Charges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Amount in cents.
 *               currency:
 *                 type: string
 *                 description: Currency code (e.g., "usd").
 *               source:
 *                 type: string
 *                 description: Payment token.
 *               description:
 *                 type: string
 *                 description: Description of the charge.
 *     responses:
 *       '202':
 *         description: Accepted
 *       '400':
 *         description: Bad Request
 *       '401':
 *         description: Unauthorized
 */
router.post('/', validateCharge, async (req, res) => {
  const { amount, currency, source, description } = req.body;  // Add customer if needed
  const merchantId = req.auth.merchant_id;

  const charge = {
    id: `ch_${uuidv4()}`,
    merchant_id: merchantId,
    amount,
    currency,
    status: 'pending',
    description,
    
  };

  queue.enqueue({ type: 'process_charge', data: { ...charge, source } });  // Include source for worker simulation

  res.status(202).json(charge);
});

/**
 * @swagger
 * /v1/charges/{id}:
 *   get:
 *     summary: Retrieve a charge
 *     description: Fetches the details of a specific charge.
 *     tags: [Charges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The charge ID.
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Not Found
 *       '401':
 *         description: Unauthorized
 */
router.get('/:id', async (req, res) => {
  const merchantId = req.auth.merchant_id;
  try {
    // This endpoint now reads the status set by the worker
    const { rows } = await db.query('SELECT * FROM charges WHERE id = $1 AND merchant_id = $2', [req.params.id, merchantId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Charge not found or is still being processed.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/charges:
 *   get:
 *     summary: List all charges
 *     description: Returns a list of charges for the authenticated merchant.
 *     tags: [Charges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of charges to return.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of charges to skip.
 *     responses:
 *       '200':
 *         description: OK
 *       '401':
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = parseInt(req.query.offset, 10) || 0;
  const merchantId = req.auth.merchant_id;

  try {
    const { rows } = await db.query('SELECT * FROM charges WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [merchantId, limit, offset]);
    const totalResult = await db.query('SELECT COUNT(*) FROM charges WHERE merchant_id = $1', [merchantId]);
    const totalCharges = parseInt(totalResult.rows[0].count, 10);

    res.json({
      object: 'list',
      has_more: (offset + limit) < totalCharges,
      data: rows,
    });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/charges/{id}:
 *   post:
 *     summary: Update a charge's metadata
 *     description: Updates the metadata of a specific charge.
 *     tags: [Charges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The charge ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *                 description: A JSON object containing key-value pairs for metadata.
 *     responses:
 *       '200':
 *         description: OK
 *       '400':
 *         description: Bad Request
 *       '404':
 *         description: Not Found
 *       '401':
 *         description: Unauthorized
 */
router.post('/:id', validateMetadata, async (req, res) => {
  const { id } = req.params;
  const { metadata } = req.body;
  const merchantId = req.auth.merchant_id;

  try {
    const { rows } = await db.query(
      'UPDATE charges SET metadata = $1 WHERE id = $2 AND merchant_id = $3 RETURNING *',
      [metadata, id, merchantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Charge not found or not authorized.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating charge metadata:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/charges/{id}/capture:
 *   post:
 *     summary: Capture an authorized charge
 *     description: Captures a previously authorized charge.
 *     tags: [Charges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The charge ID.
 *     responses:
 *       '200':
 *         description: OK
 *       '400':
 *         description: Bad Request
 *       '404':
 *         description: Not Found
 *       '401':
 *         description: Unauthorized
 */
router.post('/:id/capture', async (req, res) => {
  const { id } = req.params;
  const merchantId = req.auth.merchant_id;

  try {
    const { rows: chargeRows } = await db.query(
      'SELECT status FROM charges WHERE id = $1 AND merchant_id = $2',
      [id, merchantId]
    );

    if (chargeRows.length === 0) {
      return res.status(404).json({ error: 'Charge not found or not authorized.' });
    }

    if (chargeRows[0].status !== 'authorized') {
      return res.status(400).json({ error: 'Charge cannot be captured: Status is not authorized.' });
    }

    const { rows } = await db.query(
      'UPDATE charges SET status = $1 WHERE id = $2 AND merchant_id = $3 RETURNING *',
      ['captured', id, merchantId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Error capturing charge:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;