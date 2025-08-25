const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { generateToken } = require('../utils/auth');

const router = express.Router();

/**
 * @swagger
 * /v1/merchants:
 *   post:
 *     summary: Create a merchant (user)
 *     description: Registers a new merchant and returns API key/JWT.
 *     tags: [Merchants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               api_key:
 *                 type: string  # In production, generate securely
 *     responses:
 *       '201':
 *         description: Created
 *       '400':
 *         description: Bad Request
 */
router.post('/', async (req, res) => {
  const { name, email, api_key } = req.body;
  if (!email || !api_key) {
    return res.status(400).json({ error: 'Email and API key are required.' });
  }

  const merchantId = `mch_${uuidv4().substring(0, 24)}`;

  try {
    const { rows } = await db.query(
      'INSERT INTO merchants(merchant_id, name, email, api_key) VALUES($1, $2, $3, $4) RETURNING *',
      [merchantId, name, email, api_key]  // Hash api_key in prod
    );
    const token = generateToken(rows[0]);
    res.status(201).json({ ...rows[0], token });
  } catch (err) {
    console.error('Error creating merchant:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/merchants/login:
 *   post:
 *     summary: Login as merchant
 *     description: Authenticates and returns JWT.
 *     tags: [Merchants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               api_key:
 *                 type: string
 *     responses:
 *       '200':
 *         description: OK
 *       '401':
 *         description: Unauthorized
 */
router.post('/login', async (req, res) => {
  const { email, api_key } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM merchants WHERE email = $1 AND api_key = $2', [email, api_key]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = generateToken(rows[0]);
    res.json({ token });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/merchants/me:
 *   get:
 *     summary: Get current merchant profile
 *     description: Fetches the authenticated merchant's details.
 *     tags: [Merchants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: OK
 *       '401':
 *         description: Unauthorized
 */
router.get('/me', (req, res) => {
  res.json(req.merchant);  // From auth middleware
});

module.exports = router;