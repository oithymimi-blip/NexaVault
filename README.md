# Gasless USDT Claim dApp on BSC

A full-stack dApp that allows users to gaslessly approve USDT transfers on BNB Smart Chain using Uniswap's Permit2 contract. The admin can later execute the transfer, paying all gas fees.

## Features
- User signs a Permit2 message (zero gas) to authorize USDT transfer.
- Backend stores the signed permit securely in MongoDB.
- Admin dashboard to execute pending transfers on-chain.
- Admin pays all gas fees.
- Fully responsive, sleek dark mode UI with glassmorphism design.

## Project Structure
```
├── frontend/               # React + Vite + Tailwind CSS
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.jsx
│   │   │   ├── ApproveForm.jsx
│   │   │   ├── PermitHistory.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── AdminPanel.jsx
│   │   │   └── Layout.jsx
│   │   ├── hooks/
│   │   │   └── useMetaMask.js
│   │   ├── utils/
│   │   │   ├── permit2.js
│   │   │   ├── contracts.js
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── backend/                # Node.js + Express + MongoDB
│   ├── models/
│   │   ├── Permit.js
│   │   └── Nonce.js
│   ├── routes/
│   │   ├── permits.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── permit2Executor.js
│   ├── .env.example
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Setup & Running

1. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env # edit environment variables
   npm run dev
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Docker (optional):**
   ```bash
   docker-compose up --build
   ```

## Environment Variables (.env)
- `ADMIN_PRIVATE_KEY` – Private key of the admin executor wallet (must hold BNB for gas).
- `ADMIN_PUBLIC_ADDRESS` – Public address matching `ADMIN_PRIVATE_KEY` (used as spender in Permit2).
- `RECIPIENT_ADDRESS` – Destination wallet receiving the USDT after transfer execution.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` – Credentials for admin portal login.
- `MONGODB_URI` – MongoDB connection string.
- `BSC_RPC_URL` – BSC JSON-RPC endpoint.

## License
MIT
