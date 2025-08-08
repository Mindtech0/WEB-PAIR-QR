const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require("body-parser");
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 8000;
const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_teranchamp_key_983423';
const ADMIN_JID = '254717028877@s.whatsapp.net'; // Change to your WhatsApp number (no +)

__path = process.cwd();
require('events').EventEmitter.defaultMaxListeners = 500;

// Routes
let qrRouter = require('./qr');
let codeRouter = require('./pair');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/qr', qrRouter);
app.use('/code', codeRouter);

// Static HTML Routes
app.use('/pair', async (req, res) => {
  res.sendFile(path.join(__path, 'pair.html'));
});
app.use('/', async (req, res) => {
  res.sendFile(path.join(__path, 'main.html'));
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Start WhatsApp pairing
startPairing();

function startPairing() {
  const credsPath = './auth_info_baileys/creds.json';
  const { state, saveState } = useSingleFileAuthState(credsPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', async (update) => {
    const { connection } = update;

    if (connection === 'open') {
      try {
        const rawCreds = fs.readFileSync(credsPath);
        const base64Creds = Buffer.from(rawCreds).toString('base64');

        // HMAC sign the base64 session
        const signature = crypto.createHmac('sha256', SECRET_KEY)
                                .update(base64Creds)
                                .digest('hex');

        const signedSessionId = `${base64Creds}.${signature}`;

        const message = 
`✅ *Your Secure WhatsApp SESSION ID:*
\`\`\`${signedSessionId}\`\`\`

🔐 *Security Tip:* Only use this ID inside TERANCHAMP bot environment.
❌ Never share this session with anyone.`;

        // Send to your WhatsApp
        await sock.sendMessage(ADMIN_JID, { text: message });

        // Cleanup for next user
        await sock.logout();
        fs.rmSync('./auth_info_baileys', { recursive: true, force: true });

        console.log("✅ Session ID sent and cleaned up.");
      } catch (err) {
        console.error("❌ Failed to send session ID:", err);
      }
    }
  });
}

module.exports = app;
