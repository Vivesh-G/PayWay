const express = require('express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const chargesRouter = require('./routes/charges');
const customersRouter = require('./routes/customers');
const merchantsRouter = require('./routes/merchants');
const auth = require('./utils/auth');

const app = express();
app.use(express.json());
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Payment Gateway API',
      version: '1.0.0',
      description: 'A simple payment gateway API',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/v1/charges', auth.authenticate, chargesRouter);
app.use('/v1/customers', auth.authenticate, customersRouter);
app.use('/v1/merchants', merchantsRouter);

app.listen(3000, () => console.log('Server running on port 3000'));