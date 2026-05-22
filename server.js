const express = require('express');
const axios = require('axios');
const fs = require('fs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LIBERA A PASTA PUBLIC
app.use(express.static('public'));

const FILE = './payments.json';

// CRIA payments.json AUTOMATICAMENTE
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, '[]');
}

function readPayments() {
  return JSON.parse(fs.readFileSync(FILE));
}

function savePayments(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// PÁGINA INICIAL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// LOGIN
app.post('/login', (req, res) => {
  const { user, pass } = req.body;

  if (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS
  ) {
    return res.json({
      success: true
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Login inválido'
  });
});

// CRIAR PAGAMENTO PIX
app.post('/create-payment', async (req, res) => {
  try {

    const { amount, customer } = req.body;

    const paymentId = uuidv4();

    // ALTERE O ENDPOINT CASO NECESSÁRIO
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

    console.log(response.data);

    const pixCode =
      response.data.pixCode ||
      response.data.pix_code ||
      'PIX_EXEMPLO';

    const qrCode = await QRCode.toDataURL(pixCode);

    const payments = readPayments();

    const newPayment = {
      id: paymentId,
      amount,
      customer,
      pixCode,
      qrCode,
      status: 'pending',
      createdAt: new Date()
    };

    payments.push(newPayment);

    savePayments(payments);

    res.json({
      success: true,
      paymentId,
      pixCode,
      qrCode,
      link: `/payment.html?id=${paymentId}`
    });

  } catch (error) {

    console.log(
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error:
        error.response?.data ||
        'Erro ao criar pagamento'
    });
  }
});

// CONSULTAR PAGAMENTO
app.get('/payment/:id', (req, res) => {

  const payments = readPayments();

  const payment = payments.find(
    p => p.id === req.params.id
  );

  if (!payment) {
    return res.status(404).json({
      error: 'Pagamento não encontrado'
    });
  }

  res.json(payment);
});

// LISTAR PAGAMENTOS
app.get('/payments', (req, res) => {

  const payments = readPayments();

  res.json(payments);
});

// WEBHOOK
app.post('/webhook', (req, res) => {

  console.log(req.body);

  const payments = readPayments();

  const payment = payments.find(
    p => p.pixCode === req.body.pixCode
  );

  if (payment) {

    payment.status = 'paid';

    savePayments(payments);
  }

  res.sendStatus(200);
});

// PORTA
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
