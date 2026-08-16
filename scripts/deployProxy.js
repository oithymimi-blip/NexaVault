import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const contractPath = path.join(__dirname, '../contracts/Permit2Proxy.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'Permit2Proxy.sol': {
      content: sourceCode,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      },
    },
  },
};

console.log('Compiling Permit2Proxy.sol with optimizer (200 runs)...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const errors = output.errors.filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:', errors);
    process.exit(1);
  }
}

const contract = output.contracts['Permit2Proxy.sol']['Permit2Proxy'];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

console.log('Compilation successful!');

async function deploy() {
  const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
  const privateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!privateKey || privateKey.startsWith('0x00000000000000000000')) {
    console.error('ERROR: ADMIN_PRIVATE_KEY is missing or invalid in backend/.env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Deployer Wallet:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Wallet BNB Balance:', ethers.formatEther(balance), 'BNB');

  if (balance === 0n) {
    console.error('ERROR: Deployer wallet has 0 BNB balance. Please top up gas fees to deploy.');
    process.exit(1);
  }

  console.log('Deploying Permit2Proxy contract to BNB Smart Chain...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployedContract = await factory.deploy();

  console.log('Deployment TX sent:', deployedContract.deploymentTransaction().hash);
  console.log('Waiting for block confirmations...');
  await deployedContract.waitForDeployment();

  const proxyAddress = await deployedContract.getAddress();
  console.log('\n======================================================');
  console.log('SUCCESS! Permit2Proxy deployed to BSC:');
  console.log('Proxy Address:', proxyAddress);
  console.log('BscScan URL:  https://bscscan.com/address/' + proxyAddress);
  console.log('======================================================\n');

  // Output ABI and Bytecode for BscScan Verification
  const artifactDir = path.join(__dirname, '../contracts/artifacts');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  fs.writeFileSync(path.join(artifactDir, 'Permit2Proxy.json'), JSON.stringify({ abi, bytecode, address: proxyAddress }, null, 2));
  console.log('Artifacts saved to contracts/artifacts/Permit2Proxy.json');
}

deploy().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
