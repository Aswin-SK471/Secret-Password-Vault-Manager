# Secure Password Vault Manager

A full-stack password manager built with **React, Node.js, and SQL**, featuring encrypted storage, master-password protection, and advanced security tools.

---

## Features

- Master Password Authentication  
- Encrypted Password Storage  
- Session Auto-Lock (Inactivity Protection)  
- Password Generator  
- Password Strength Analysis  
- Password Reuse Detection  
- Breach Detection (Have I Been Pwned API)  
- Favorites System  
- Categories Management  
- Export / Import Vault (JSON & Encrypted `.enc`)  
- Modern UI with Dark/Light Mode & Animations  
- Responsive Design  

---

## Tech Stack

### Frontend
- React.js  
- CSS (Glassmorphism UI, Animations)  

### Backend
- Node.js  
- Express.js  

### Database
- SQL (MySQL)  

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/Aswin-SK471/Secret-Password-Vault-Manager.git
cd Secret-Password-Vault-Manager
```

### 2. Setup Backend

```bash
cd server
npm install
npm start
```

### 3. Setup Frontend

```bash
cd password-manager
npm install
npm start
```

---

## How It Works

1. Users register or log in with credentials  
2. A master password unlocks the vault  
3. Passwords are securely stored and managed  
4. Features include generation, analysis, categorization, and export/import  

---

## Project Structure

```
root/
 ├── password-manager/   # React frontend
 ├── server/             # Node.js backend
 ├── package.json
 └── README.md
```

---

## Notes

- Backend must be running for authentication and data storage  
- Do not commit `.env` or sensitive credentials  
- `node_modules` and build folders are excluded via `.gitignore`  

---

## Future Improvements

- Two-factor authentication (2FA)  
- Browser extension  
- Cloud sync  
- Biometric unlock  
