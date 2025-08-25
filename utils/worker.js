const db = require('./db');
const queue = require('./queue');

const processJob = async (job) => {
  if (job.type === 'process_charge') {
    const { id, amount, currency, description, merchant_id, source } = job.data;
    try {
      // Simulate payment validation
      if (!source || source !== 'valid_token') {
        throw new Error('Invalid source');
      }

      // Insert pending
      await db.query('INSERT INTO charges(id, merchant_id, amount, currency, status, description) VALUES($1, $2, $3, $4, $5, $6)',
        [id, merchant_id, amount, currency, 'pending', description]);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update to succeeded
      await db.query('UPDATE charges SET status = $1 WHERE id = $2', ['succeeded', id]);
    } catch (err) {
      await db.query('INSERT INTO charges(id, merchant_id, amount, currency, status, description) VALUES($1, $2, $3, $4, $5, $6)',
        [id, merchant_id, amount, currency, 'failed', description]);
    }
  }
};

const startWorker = () => {
  console.log('Worker started. Listening for jobs...');
  setInterval(() => {
    const job = queue.dequeue();
    if (job) {
      processJob(job);
    }
  }, 3000); // Check for jobs every 3 seconds
};

startWorker();
