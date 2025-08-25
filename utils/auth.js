const jsonwebtoken = require('jsonwebtoken');
const { expressjwt } = require('express-jwt');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET

// Middleware to verify JWT and set req.merchant
const authenticate = expressjwt({
    secret: SECRET,
    algorithms: ['HS256'],
    
});

// Function to generate JWT (used in login/create merchant)
const generateToken = (merchant) => {
    return jsonwebtoken.sign({ merchant_id: merchant.merchant_id, email: merchant.email }, SECRET, { expiresIn: '1h' });
};

module.exports = { authenticate, generateToken };