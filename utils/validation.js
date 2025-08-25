const validateCharge = (req, res, next) => {
  const { amount, currency, source } = req.body;
  if (!amount || !currency || !source) {
    return res.status(400).json({ error: 'Amount, currency, and source are required.' });
  }
  next();
};

const validateMetadata = (req, res, next) => {
  const { metadata } = req.body;
  if (!metadata || typeof metadata !== 'object') {
    return res.status(400).json({ error: 'Metadata must be an object.' });
  }
  next();
};

module.exports = { validateCharge, validateMetadata };