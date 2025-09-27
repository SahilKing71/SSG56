// server.js

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// --- CONFIGURATION ---

// Heroku aur Local Port
const PORT = process.env.PORT || 3300; 

// Replace this with your actual MongoDB connection string!
// Heroku par aapko isko Environment Variable (Config Vars) mein daalna chahiye
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/livewebsitedb'; 

app.use(express.static(__dirname)); // Serve static files (like index.html)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- DATABASE CONNECTION & SCHEMAS ---

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// 1. User Schema for Login
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 2. Complaint Schema
const ComplaintSchema = new mongoose.Schema({
    customerName: String,
    details: String,
    date: { type: Date, default: Date.now }
});
const Complaint = mongoose.model('Complaint', ComplaintSchema);

// 3. Chat Message Schema
const ChatMessageSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);


// --- API ROUTES ---

// 1. Login/Registration API
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({ success: true, message: 'Registration successful! Please login.' });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Username already exists or Invalid data.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (user) {
        // Simple authentication: success sends the main page path
        res.json({ success: true, redirect: '/main' }); 
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});


// 2. Complaint Submission API
app.post('/api/complaint', async (req, res) => {
    const { customerName, details } = req.body;
    try {
        const newComplaint = new Complaint({ customerName, details });
        await newComplaint.save();
        res.json({ success: true, message: 'Shikayat submitted successfully! We will contact you soon.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not save complaint.' });
    }
});


// --- ROUTE HANDLER ---

// Default route (Login Page)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Main Feature Page (Simulated protected route after login)
app.get('/main', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


// --- SOCKET.IO (LIVE CHAT) ---

// Load last 20 messages when a user connects
async function loadChatHistory() {
    return await ChatMessage.find().sort({ timestamp: 1 }).limit(20);
}

io.on('connection', async (socket) => {
    console.log('A customer connected for live chat.');
    
    // Send history to the newly connected client
    const history = await loadChatHistory();
    socket.emit('chat history', history);

    // Listen for a chat message
    socket.on('chat message', async (data) => {
        // Save the message to the database
        const newMsg = new ChatMessage(data);
        await newMsg.save();

        // Broadcast the message to ALL connected clients
        io.emit('chat message', data);
    });

    socket.on('disconnect', () => {
        console.log('A customer disconnected.');
    });
});


// --- START SERVER ---

server.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}. Open http://localhost:${PORT}`);
});
