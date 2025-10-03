// server.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// env
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'admin';
const JWT_SECRET  = process.env.JWT_SECRET  || 'secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h'; // mínimo 1 hora

// ---------- RUTA: POST /api/v1/auth ----------
app.post('/api/v1/auth', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'invalid credentials' });
  }

  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    // token
    const payload = { email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return res.status(200).json({ token });
  } else {
    return res.status(400).json({ error: 'invalid credentials' });
  }
});

// ---------- Middleware ----------
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ error: 'User not authenticated' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(403).json({ error: 'User not authenticated' });
  }

  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'User not authenticated' });
    }
    req.user = decoded;
    next();
  });
}

// ---------- RUTA PROTEGIDA: POST /api/v1/pokemonDetails ----------
app.post('/api/v1/pokemonDetails', authenticateJWT, async (req, res) => {
  const { pokemonName } = req.body || {};
  if (!pokemonName || typeof pokemonName !== 'string') {
    // 400 
    return res.status(400).json({
      name: "",
      species: "",
      weight: "",
      img_url: ""
    });
  }

  const name = pokemonName.trim().toLowerCase();
  const pokeUrl = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`;

  try {
    const response = await axios.get(pokeUrl);
    const data = response.data;

    // Map: name, species (data.species.name), weight (string), img_url (front_default)
    const result = {
      name: data.name || "",
      species: (data.species && data.species.name) ? data.species.name : "",
      weight: (typeof data.weight !== 'undefined') ? String(data.weight) : "",
      img_url: (data.sprites && (data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default)) || ""
    };

    return res.status(200).json(result);
  } catch (err) {
    // 404
    if (err.response && err.response.status === 404) {
      return res.status(400).json({
        name: "",
        species: "",
        weight: "",
        img_url: ""
      });
    }

    // Error
    console.error('Error fetching from PokeAPI:', err.message || err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// Default route salud
app.get('/', (req, res) => res.send('Backend running'));

// Start
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
