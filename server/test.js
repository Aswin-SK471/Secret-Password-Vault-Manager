const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'password_manager'
});

const hashPassword = (password) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

db.connect(err => {
  if (err) {
    console.error('DB Error:', err);
  } else {
    console.log('Connected');
    const hashed = hashPassword('testpass');
    console.log('Hashed length:', hashed.length);
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.query(sql, ['testuser3', hashed], (err, result) => {
      if (err) {
        console.error('SQL Error:', err);
      } else {
        console.log('Inserted:', result);
      }
      db.end();
    });
  }
});