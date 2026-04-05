const mysql = require('mysql2');
const fs = require('fs');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'password_manager'
});

let output = '';

db.query(
  "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='password_manager' AND TABLE_NAME='users' ORDER BY ORDINAL_POSITION",
  (err, rows) => {
    if (err) { output += 'USERS ERROR: ' + err.message + '\n'; }
    else {
      output += 'USERS TABLE:\n';
      rows.forEach(r => { output += '  ' + r.COLUMN_NAME + ' | ' + r.DATA_TYPE + ' | key=' + r.COLUMN_KEY + '\n'; });
    }
    
    db.query(
      "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='password_manager' AND TABLE_NAME='vault' ORDER BY ORDINAL_POSITION",
      (err2, rows2) => {
        if (err2) { output += 'VAULT ERROR: ' + err2.message + '\n'; }
        else {
          output += 'VAULT TABLE:\n';
          rows2.forEach(r => { output += '  ' + r.COLUMN_NAME + ' | ' + r.DATA_TYPE + ' | key=' + r.COLUMN_KEY + '\n'; });
        }
        
        fs.writeFileSync('schema_report.txt', output);
        console.log('Report written to schema_report.txt');
        db.end();
      }
    );
  }
);
