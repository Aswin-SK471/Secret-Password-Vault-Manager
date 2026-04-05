const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------ MySQL Connection ------------------ */
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'password_manager'
});

db.connect(err => {
  if (err) {
    console.error('==================== DB CONNECTION ERROR ====================');
    console.error('DB Error:', err.message);
    console.error('Host:', 'localhost', '| Database:', 'password_manager');
    console.error('Make sure MySQL is running and the database exists.');
    console.error('To create the database, run: CREATE DATABASE password_manager;');
    console.error('=============================================================');
  } else {
    console.log('[DB] MySQL Connected successfully to password_manager');
    createTables();
  }
});

/* ------------------ Auto Create Tables ------------------ */
function createTables() {
  const usersTable = `CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    master_password VARCHAR(255)
  )`;

  const vaultTable = `CREATE TABLE vault (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    site VARCHAR(255),
    site_username VARCHAR(255),
    encrypted_password TEXT,
    notes TEXT,
    category VARCHAR(255) DEFAULT 'Other',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  // Drop tables if they exist to ensure correct schema
  db.query('DROP TABLE IF EXISTS vault', (err) => {
    if (err) console.log('Error dropping vault table:', err);
    else console.log('Dropped vault table');
  });

  db.query('DROP TABLE IF EXISTS users', (err) => {
    if (err) console.log('Error dropping users table:', err);
    else console.log('Dropped users table');
  });

  // Create tables
  db.query(usersTable, (err) => {
    if (err) console.log('Error creating users table:', err);
    else console.log('Users table ready');
  });

  db.query(vaultTable, (err) => {
    if (err) console.log('Error creating vault table:', err);
    else console.log('Vault table ready');
  });
}

/* ------------------ Password Hash Function ------------------ */
const hashPassword = (password) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

/* ------------------ Test Route ------------------ */
app.get('/', (req, res) => {
  res.send('Secure Password Manager API Running');
});

/* ------------------ Register API ------------------ */
app.post('/register', (req, res) => {
  console.log(req.body);

  const { username, password, masterPassword } = req.body;

  if (!username || !password || !masterPassword) {
    return res.status(400).json({ success: false, message: 'Username, password, and master password required' });
  }

  if (masterPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Master password must be at least 8 characters' });
  }

  const hashedPassword = hashPassword(password);
  const hashedMaster = hashPassword(masterPassword);

  const sql = "INSERT INTO users (username, password, master_password) VALUES (?, ?, ?)";

  db.query(sql, [username, hashedPassword, hashedMaster], (err, result) => {
    if (err) {
      console.error(err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Username already exists' });
      }
      return res.status(500).json({ success: false, message: 'Error registering user' });
    }
    console.log('User registered successfully');
    res.json({ success: true, message: 'User registered successfully' });
  });
});

/* ------------------ Login API ------------------ */
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const sql = "SELECT id, password FROM users WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = results[0];
    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    res.json({ success: true, userId: user.id, username: username, message: 'Login successful' });
  });
});

/* ------------------ Verify Master Password API ------------------ */
app.post('/verify-master', (req, res) => {
  const { username, masterPassword } = req.body;

  if (!username || !masterPassword) {
    return res.status(400).json({ success: false, message: 'Username and master password required' });
  }

  const sql = "SELECT master_password FROM users WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const user = results[0];
    const isValid = bcrypt.compareSync(masterPassword, user.master_password);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid master password' });
    }

    res.json({ success: true, message: 'Master password verified' });
  });
});

/* ------------------ Vault CRUD APIs ------------------ */

// Add vault entry
app.post('/vault/add', (req, res) => {
  const { userId, site, site_username, encrypted_password, notes, category, is_favorite } = req.body;

  if (!userId || !site || !encrypted_password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const sql = "INSERT INTO vault (user_id, site, site_username, encrypted_password, notes, category, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(sql, [userId, site, site_username, encrypted_password, notes || '', category || 'Other', is_favorite || false], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error adding vault entry' });
    }
    res.json({ success: true, message: 'Vault entry added', id: result.insertId });
  });
});

// Get all vault entries for a user
app.get('/vault/:userId', (req, res) => {
  const { userId } = req.params;

  const sql = "SELECT * FROM vault WHERE user_id = ? ORDER BY created_at DESC";
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error fetching vault entries' });
    }
    res.json({ success: true, data: results });
  });
});

// Update vault entry
app.put('/vault/update/:id', (req, res) => {
  const { id } = req.params;
  const { site, site_username, encrypted_password, notes, category, is_favorite } = req.body;

  const sql = "UPDATE vault SET site = ?, site_username = ?, encrypted_password = ?, notes = ?, category = ?, is_favorite = ? WHERE id = ?";
  db.query(sql, [site, site_username, encrypted_password, notes || '', category || 'Other', is_favorite || false, id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error updating vault entry' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, message: 'Vault entry updated' });
  });
});

// Delete vault entry
app.delete('/vault/delete/:id', (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM vault WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error deleting vault entry' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, message: 'Vault entry deleted' });
  });
});

// Toggle favorite
app.put('/vault/favorite/:id', (req, res) => {
  const { id } = req.params;
  const { is_favorite } = req.body;

  const sql = "UPDATE vault SET is_favorite = ? WHERE id = ?";
  db.query(sql, [is_favorite || false, id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error updating favorite status' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, message: 'Favorite status updated' });
  });
});

/* ------------------ Export Vault ------------------ */
app.get('/vault/export/:userId', (req, res) => {
  const { userId } = req.params;

  const sql = "SELECT site, site_username, encrypted_password, notes, category, is_favorite, created_at FROM vault WHERE user_id = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error exporting vault' });
    }
    res.json({ success: true, data: results });
  });
});

/* ------------------ Import Vault ------------------ */
app.post('/vault/import', (req, res) => {
  const { userId, entries } = req.body;

  if (!userId || !entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid import data' });
  }

  const sql = "INSERT INTO vault (user_id, site, site_username, encrypted_password, notes, category, is_favorite) VALUES ?";
  const values = entries.map(e => [userId, e.site, e.site_username, e.encrypted_password, e.notes || '', e.category || 'Other', e.is_favorite || false]);

  db.query(sql, [values], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Error importing vault entries' });
    }
    res.json({ success: true, message: `${result.affectedRows} entries imported` });
  });
});

/* ------------------ Start Server ------------------ */
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});