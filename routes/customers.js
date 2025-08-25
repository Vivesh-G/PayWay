const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

const router = express.Router();

/**
 * @swagger
 * /v1/customers/{id}/charges:
 *   get:
 *     summary: List all charges for a customer
 *     description: Returns a list of charges associated with a specific customer.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer ID.
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
 *       '404':
 *         description: Not Found
 *       '401':
 *         description: Unauthorized
 */
router.get('/:id/charges', async (req, res) => {
  const { id } = req.params;
  const merchantId = req.auth.merchant_id;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const customerCheck = await db.query('SELECT id FROM customers WHERE id = $1 AND merchant_id = $2', [id, merchantId]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or not authorized.' });
    }

    const { rows } = await db.query(
      'SELECT * FROM charges WHERE merchant_id = $1 AND description LIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      [merchantId, `%${id}%`, limit, offset]
    );

    const totalResult = await db.query(
      'SELECT COUNT(*) FROM charges WHERE merchant_id = $1 AND description LIKE $2',
      [merchantId, `%${id}%`]
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    res.json({
      object: 'list',
      has_more: (offset + limit) < total,
      data: rows,
    });
  } catch (err) {
    console.error('Error listing charges for customer:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /v1/customers:
 *   post:
 *     summary: Create a customer
 *     description: Creates a customer object.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Customer's name.
 *               email:
 *                 type: string
 *                 description: Customer's email.
 *               description:
 *                 type: string
 *                 description: Description of the customer.
 *     responses:
 *       '201':
 *         description: Created
 *       '400':
 *         description: Bad Request
 *       '401':
 *         description: Unauthorized
 */
router.post('/', async (req, res) => {
    const { name, email, description } = req.body;
    const merchantId = req.auth.merchant_id;

    if (!name && !email) {
        return res.status(400).json({ error: 'At least one of name or email is required to create a customer.' });
    }

    const customerId = `cus_${uuidv4().replace(/-/g, '').substring(0, 24)}`;

    try {
        const insertQuery = 'INSERT INTO customers(id, merchant_id, name, email, description) VALUES($1, $2, $3, $4, $5) RETURNING *';
        const insertValues = [customerId, merchantId, name, email, description];
        const { rows } = await db.query(insertQuery, insertValues);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /v1/customers/{id}:
 *   get:
 *     summary: Retrieve a customer
 *     description: Fetches the details of a specific customer.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer ID.
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Not Found
 *       '401':
 *         description: Unauthorized
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const merchantId = req.auth.merchant_id;

    try {
        const result = await db.query('SELECT * FROM customers WHERE id = $1 AND merchant_id = $2', [id, merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found or not authorized.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error retrieving customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /v1/customers/{id}:
 *   post:
 *     summary: Update a customer
 *     description: Updates the details of a specific customer.
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the customer.
 *               email:
 *                 type: string
 *                 description: New email for the customer.
 *               description:
 *                 type: string
 *                 description: New description for the customer.
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
router.post('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, description } = req.body;
    const merchantId = req.auth.merchant_id;

    if (!name && !email && !description) {
        return res.status(400).json({ error: 'At least one field (name, email, or description) is required for update.' });
    }

    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) { updateFields.push(`name = $${paramIndex++}`); updateValues.push(name); }
    if (email !== undefined) { updateFields.push(`email = $${paramIndex++}`); updateValues.push(email); }
    if (description !== undefined) { updateFields.push(`description = $${paramIndex++}`); updateValues.push(description); }

    updateValues.push(id); // $paramIndex
    updateValues.push(merchantId); // $(paramIndex + 1)

    try {
        const updateQuery = `UPDATE customers SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND merchant_id = $${paramIndex + 1} RETURNING *`;
        const { rows } = await db.query(updateQuery, updateValues);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found or not authorized.' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;