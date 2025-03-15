// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const { authenticator } = require('otplib');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

mongoose.set('debug', true);

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    secret: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/register', async (req, res) => {
    console.log(`[${req.method}] ${req.url} - Registration request received.`);
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, error: 'Username is required.' });
    }
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'Username already exists.' });
        }
        const secret = authenticator.generateSecret();
        const newUser = new User({ username, secret });
        await newUser.save();
        res.status(201).json({ success: true, message: 'User registered successfully.' });
    } catch (err) {
        console.error('❌ Registration error:', err);
        res.status(500).json({ success: false, error: 'Registration failed.' });
    }
});

app.get('/qr', async (req, res) => {
    const username = req.query.user;
    if (!username) {
        return res.status(400).json({ success: false, error: 'Username is required.' });
    }
    try {
        const userDoc = await User.findOne({ username });
        if (!userDoc) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const qrData = `otpauth://totp/MyApp:${username}?secret=${userDoc.secret}&issuer=MyApp`;
        const dataURL = await qrcode.toDataURL(qrData);
        res.json({ qrCode: dataURL });
    } catch (err) {
        console.error('❌ QR code error:', err);
        res.status(500).json({ success: false, error: 'QR code generation failed.' });
    }
});

app.post('/verify', async (req, res) => {
    const { user, token } = req.body;
    if (!user || !token) {
        return res.status(400).json({ success: false, error: 'Username and token are required.' });
    }
    try {
        const userDoc = await User.findOne({ username: user });
        if (!userDoc) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        const isValid = authenticator.verify({ token, secret: userDoc.secret, window: 2 });
        res.json({ verified: isValid, message: isValid ? 'Login successful.' : 'Invalid token.' });
    } catch (err) {
        console.error('❌ Verification error:', err);
        res.status(500).json({ verified: false, error: 'Verification failed.' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});
