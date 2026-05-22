const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.static('public'));

const FILE = './payments.json';

function readPayments() {
  return JSON.parse(fs.readFileSync(FILE));
}

function savePayments(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

app.post('/login', (req, res) => {
  const { user, pass } = req.body;

  if (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS
  ) {
    return res.json({ success: true });
  }

  res.status(401).json({ success: false });
});

app.post('/create-payment', async (req, res) => {
  try {
    const { amount, customer } = req.body;

    const paymentId = uuidv4();

    const response = await axios.post(
      'https://app.sigilopay.com.br/api/v1/pix/create',
      {
        amount,
        customer
      },
      {
        headers: {
          'x-public-key': process.env.PUBLIC_KEY,
          'x-secret-key': process.env.SECRET_KEY
        }
      }
    );

    const pixCode = response.data.pixCode || 'PIX_EXEMPLO';

    const qrCode = await QRCode.toDataURL(pixCode);

    const payments = readPayments();

    payments.push({
      id: paymentId,
      amount,
      customer,
      pixCode,
      qrCode,
      status: 'pending',
      createdAt: new Date()
    });

    savePayments(payments);

    res.json({
      success: true,
      paymentId,
      link: `/payment.html?id=${paymentId}`,
      pixCode,
      qrCode
    });
  } catch (err) {
    console.log(err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: 'Erro ao criar pagamento'
    });
  }
});

app.get('/payment/:id', (req, res) => {
  const payments = readPayments();

  const payment = payments.find(p => p.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ error: 'Pagamento não encontrado' });
  }

  res.json(payment);
});

app.get('/payments', (req, res) => {
  const payments = readPayments();
  res.json(payments);
});

app.post('/webhook', (req, res) => {
  const body = req.body;

  const payments = readPayments();

  const payment = payments.find(
    p => p.pixCode === body.pixCode
  );

  if (payment) {
    payment.status = 'paid';
    savePayments(payments);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor online');
});
