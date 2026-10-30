const nodemailer = require('nodemailer');

function escaparHtml(valor) {
  return String(valor || '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caractere]);
}

async function enviarEmailRecuperacao({ to, nome, codigo }) {
  const usuario = process.env.SMTP_USER;
  const senha = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const porta = Number(process.env.SMTP_PORT || 587);

  if (!usuario || !senha) {
    throw new Error('Configure SMTP_USER e SMTP_PASS no arquivo .env.');
  }

  const transportador = nodemailer.createTransport({
    host,
    port: porta,
    secure: process.env.SMTP_SECURE === 'true' || porta === 465,
    auth: { user: usuario, pass: senha },
    requireTLS: porta === 587
  });

  const nomeSeguro = escaparHtml(nome || '');
  const remetente = process.env.SMTP_FROM || usuario;

  await transportador.sendMail({
    from: `NotaDez <${remetente}>`,
    to,
    subject: 'Código de recuperação de senha | NotaDez',
    text: `Olá${nome ? `, ${nome}` : ''}!\n\nRecebemos uma solicitação para recuperar o acesso à sua conta NotaDez. Use o código ${codigo} para redefinir sua senha. O código expira em 10 minutos.\n\nSe você não solicitou esta recuperação, ignore este e-mail.`,
    html: `
      <main style="max-width:560px;margin:24px auto;padding:32px;font-family:Arial,sans-serif;color:#26334a;border:1px solid #e3eaf3;border-radius:12px">
        <h1 style="margin:0 0 16px;color:#5146ee;font-size:24px">NotaDez</h1>
        <p>Ol${nome ? `á, ${nomeSeguro}` : 'á'}!</p>
        <p>Recebemos uma solicitação para recuperar o acesso à sua conta NotaDez.</p>
        <p>Use este código de 6 dígitos para redefinir sua senha:</p>
        <p style="margin:24px 0;padding:16px;background:#f0efff;border-radius:8px;text-align:center;color:#5146ee;font-size:32px;font-weight:bold;letter-spacing:8px">${codigo}</p>
        <p>O código expira em 10 minutos. Se você não solicitou esta recuperação, ignore este e-mail.</p>
        <p style="margin-top:28px;color:#78869c;font-size:12px">NotaDez Academic System</p>
      </main>
    `
  });
}

module.exports = enviarEmailRecuperacao;
