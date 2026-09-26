require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initialize = require('./routes/initialize.js')

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors(process.env.VITE_FRONTEND_URI));
app.use(express.json());
app.use('/initialize', initialize);

app.get('/', (req, res) => {
    res.status(200).json({ message: "The server is running" })
})

app.get('/api/health', (req, res) => {
    res.status(200).json({ message: 'ok' })
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});