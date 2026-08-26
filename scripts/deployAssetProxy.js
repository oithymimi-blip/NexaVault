import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import https from 'https';
import querystring from 'querystring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const CONTRACT_SOL  = 'AssetProxy.sol';
const CONTRACT_NAME = 'AssetProxy';

const contractPath = path.join(__dirname, '../contracts', CONTRACT_SOL);
const sourceCode   = fs.readFileSync(contractPath, 'utf8');

// ── Compile ──────────────────────────────────────────────────────────────────
const input = {
  language: 'Solidity',
  sources: { [CONTRACT_SOL]: { content: sourceCode } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
  },
};

console.log(`Compiling ${CONTRACT_SOL} with optimizer (200 runs)...`);
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const errors = output.errors.filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:', errors);
    process.exit(1);
  }
}

const contract  = output.contracts[CONTRACT_SOL][CONTRACT_NAME];
const abi       = contract.abi;
const bytecode  = contract.evm.bytecode.object;
const solcVer   = solc.version();
const compilerVersion = 'v' + solcVer.replace('.Emscripten.clang', '');
console.log('Compilation successful! Compiler:', compilerVersion);

// ── BSCScan V2 helpers ────────────────────────────────────────────────────────
// Uses BSCScan's own V2 endpoint (avoids api2.etherscan.io timeout)
const BSCSCAN_HOST = 'api.bscscan.com';
const BSCSCAN_V2   = '/v2/api';

function httpsPost(hostname, path, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function submitVerification(contractAddress, apiKey) {
  const postData = querystring.stringify({
    chainid: '56',
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: sourceCode,
    codeformat: 'solidity-single-file',
    contractname: CONTRACT_NAME,
    compilerversion: compilerVersion,
    optimizationUsed: '1',
    runs: '200',
    licenseType: '3', // MIT
  });
  return httpsPost(BSCSCAN_HOST, BSCSCAN_V2, postData);
}

function pollStatus(guid, apiKey) {
  const params = querystring.stringify({
    chainid: '56',
    apikey: apiKey,
    module: 'contract',
    action: 'checkverifystatus',
    guid,
  });
  return httpsGet(BSCSCAN_HOST, `${BSCSCAN_V2}?${params}`);
}

// ── Deploy ────────────────────────────────────────────────────────────────────
async function deploy() {
  const rpcUrl        = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
  const privateKey    = process.env.DEPLOY_PRIVATE_KEY;
  const bscscanApiKey = process.env.BSCSCAN_API_KEY;

  if (!privateKey) {
    console.error('ERROR: DEPLOY_PRIVATE_KEY is missing in backend/.env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(privateKey, provider);

  console.log('Deployer Wallet:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Wallet BNB Balance:', ethers.formatEther(balance), 'BNB');

  if (balance === 0n) {
    console.error('ERROR: Deployer wallet has 0 BNB. Please top up.');
    process.exit(1);
  }

  console.log(`\nDeploying ${CONTRACT_NAME} to BNB Smart Chain...`);
  const factory          = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployedContract = await factory.deploy();

  console.log('Deployment TX sent:', deployedContract.deploymentTransaction().hash);
  console.log('Waiting for confirmations...');
  await deployedContract.waitForDeployment();

  const contractAddress = await deployedContract.getAddress();
  console.log('\n======================================================');
  console.log(`SUCCESS! ${CONTRACT_NAME} deployed to BSC:`);
  console.log('Contract Address:', contractAddress);
  console.log('BscScan URL:     https://bscscan.com/address/' + contractAddress);
  console.log('======================================================\n');

  // Save artifacts
  const artifactDir = path.join(__dirname, '../contracts/artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, `${CONTRACT_NAME}.json`),
    JSON.stringify({ abi, bytecode, address: contractAddress }, null, 2)
  );
  console.log(`Artifacts saved to contracts/artifacts/${CONTRACT_NAME}.json`);

  // Update .env with new address
  const envPath    = path.join(__dirname, '../backend/.env');
  let   envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('PROXY_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/PROXY_CONTRACT_ADDRESS=.*/g, `PROXY_CONTRACT_ADDRESS=${contractAddress}`);
  } else {
    envContent += `\nPROXY_CONTRACT_ADDRESS=${contractAddress}`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log('backend/.env updated with new PROXY_CONTRACT_ADDRESS\n');

  // ── Verify ────────────────────────────────────────────────────────────────
  if (!bscscanApiKey) {
    console.log('[SKIP] BSCSCAN_API_KEY not set — skipping automatic verification.');
    return;
  }

  console.log('Waiting 20 seconds for BSCScan to index the contract...');
  await new Promise((r) => setTimeout(r, 20000));

  console.log(`Submitting source to BSCScan V2 (${BSCSCAN_HOST})...`);
  const verifyResult = await submitVerification(contractAddress, bscscanApiKey);
  console.log('BSCScan response:', JSON.stringify(verifyResult, null, 2));

  if (verifyResult.status !== '1') {
    if (verifyResult.result && verifyResult.result.toLowerCase().includes('already')) {
      console.log('\n✅ Contract is already VERIFIED on BSCScan!');
      console.log('View at: https://bscscan.com/address/' + contractAddress + '#code');
      return;
    }
    console.error('\n❌ Verification submission failed:', verifyResult.result);
    console.log('\nManual verification: https://bscscan.com/verifyContract?a=' + contractAddress);
    return;
  }

  const guid = verifyResult.result;
  console.log('Verification GUID:', guid);
  console.log('Polling status (up to 2 min)...\n');

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const statusResult = await pollStatus(guid, bscscanApiKey);
    console.log(`[${i + 1}/15] Status: ${statusResult.result}`);

    if (statusResult.result === 'Pass - Verified') {
      console.log('\n✅ Contract VERIFIED on BSCScan!');
      console.log('View at: https://bscscan.com/address/' + contractAddress + '#code');
      return;
    }
    if (statusResult.result && statusResult.result.toLowerCase().startsWith('fail')) {
      console.error('\n❌ Verification FAILED:', statusResult.result);
      return;
    }
  }

  console.log('\n⏳ Polling timed out. Check manually:');
  console.log('https://bscscan.com/address/' + contractAddress + '#code');
}

deploy().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
