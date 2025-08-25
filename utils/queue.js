// A simple in-memory message queue for simulation
const queue = [];

const enqueue = (job) => {
  console.log(`Adding job to queue: ${job.type} for charge ${job.data.id}`);
  queue.push(job);
};

const dequeue = () => {
  return queue.shift(); // Gets the first item
};

module.exports = {
  enqueue,
  dequeue,
  _queue: queue, // Exporting for inspection if needed
};