import fs from 'fs';
import path from 'path';
import solc from 'solc';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import https from 'https';
import querystring from 'querystring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const contractPath = path.join(__dirname, '../contracts/TokenGateway.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Contract address from the deployment
const CONTRACT_ADDRESS = '0x079AEb2073077bAbe878373ecE503c0eE850e92E';

// Build & detect compiler version
const input = {
  language: 'Solidity',
  sources: { 'TokenGateway.sol': { content: sourceCode } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
  },
};

console.log('Compiling to detect compiler version...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const solcVersion = solc.version();
const compilerVersion = 'v' + solcVersion.replace('.Emscripten.clang', '');
console.log('Compiler version detected:', compilerVersion);

// BSCScan V2 API helpers (chainid=56 = BSC)
function verifyOnBscscanV2(contractAddress, source, compilerVersion, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: contractAddress,
      sourceCode: source,
      codeformat: 'solidity-single-file',
      contractname: 'TokenGateway',
      compilerversion: compilerVersion,
      optimizationUsed: '1',
      runs: '200',
      licenseType: '3', // MIT
      chainid: '56',
    });

    const options = {
      hostname: 'api2.etherscan.io',
      path: '/v2/api?chainid=56',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

function checkVerificationStatusV2(guid, apiKey) {
  return new Promise((resolve, reject) => {
    const params = querystring.stringify({
      apikey: apiKey,
      module: 'contract',
      action: 'checkverifystatus',
      guid,
      chainid: '56',
    });

    const options = {
      hostname: 'api2.etherscan.io',
      path: '/v2/api?chainid=56&' + params,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  const bscscanApiKey = process.env.BSCSCAN_API_KEY;

  if (!bscscanApiKey) {
    console.error('ERROR: BSCSCAN_API_KEY is missing in backend/.env');
    process.exit(1);
  }

  console.log('\nContract to verify:', CONTRACT_ADDRESS);
  console.log('BSCScan URL:       https://bscscan.com/address/' + CONTRACT_ADDRESS);
  console.log('\nSubmitting source code to BSCScan V2 API...');

  const verifyResult = await verifyOnBscscanV2(CONTRACT_ADDRESS, sourceCode, compilerVersion, bscscanApiKey);
  console.log('BSCScan response:', JSON.stringify(verifyResult, null, 2));

  if (verifyResult.status !== '1') {
    // Check if already verified
    if (verifyResult.result && verifyResult.result.toLowerCase().includes('already')) {
      console.log('\n✅ Contract is already VERIFIED on BSCScan!');
      console.log('View at: https://bscscan.com/address/' + CONTRACT_ADDRESS + '#code');
      return;
    }
    console.error('Verification submission failed:', verifyResult.result);
    process.exit(1);
  }

  const guid = verifyResult.result;
  console.log('Verification GUID:', guid);
  console.log('Polling verification status (this may take 1-2 minutes)...\n');

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const statusResult = await checkVerificationStatusV2(guid, bscscanApiKey);
    console.log('[' + (i + 1) + '/15] Status:', statusResult.result);

    if (statusResult.result === 'Pass - Verified') {
      console.log('\n✅ Contract VERIFIED on BSCScan!');
      console.log('View at: https://bscscan.com/address/' + CONTRACT_ADDRESS + '#code');
      return;
    }
    if (statusResult.result && statusResult.result.toLowerCase().startsWith('fail')) {
      console.error('\n❌ Verification FAILED:', statusResult.result);
      process.exit(1);
    }
  }

  console.log('\n⏳ Polling timed out. Check manually at:');
  console.log('https://bscscan.com/address/' + CONTRACT_ADDRESS + '#code');
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
