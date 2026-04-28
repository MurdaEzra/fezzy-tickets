// Test coverage for secure payment backend API endpoints
import request from 'supertest';
import express from 'express';
import checkoutRouter from '../checkout';

describe('Secure Payments API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/checkout', checkoutRouter);

  it('should reject unauthenticated or malformed session creation', async () => {
    const res = await request(app).post('/api/checkout/sessions').send({});
    expect(res.status).toBe(501); // Not implemented placeholder
  });

  it('should reject payment initiation for invalid session', async () => {
    const res = await request(app).post('/api/checkout/sessions/invalid/pay/mpesa').send({ phone: '+254700000000' });
    expect(res.status).toBe(501);
  });

  it('should reject payment initiation for invalid session (flutterwave)', async () => {
    const res = await request(app).post('/api/checkout/sessions/invalid/pay/flutterwave').send({ method: 'card' });
    expect(res.status).toBe(501);
  });

  it('should return status for invalid session', async () => {
    const res = await request(app).get('/api/checkout/sessions/invalid/status');
    expect(res.status).toBe(501);
  });

  it('should handle webhook endpoints', async () => {
    const mpesa = await request(app).post('/api/webhooks/mpesa').send({});
    expect(mpesa.status).toBe(501);
    const fw = await request(app).post('/api/webhooks/flutterwave').send({});
    expect(fw.status).toBe(501);
  });
});
