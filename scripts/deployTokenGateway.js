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

const contractPath = path.join(__dirname, '../contracts/TokenGateway.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'TokenGateway.sol': {
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

console.log('Compiling TokenGateway.sol with optimizer (200 runs)...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const errors = output.errors.filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:', errors);
    process.exit(1);
  }
}

const contract = output.contracts['TokenGateway.sol']['TokenGateway'];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

console.log('Compilation successful!');

// BSCScan verification helper
function verifyOnBscscan(contractAddress, sourceCode, compilerVersion, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      apikey: apiKey,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: contractAddress,
      sourceCode: sourceCode,
      codeformat: 'solidity-single-file',
      contractname: 'TokenGateway',
      compilerversion: compilerVersion,
      optimizationUsed: '1',
      runs: '200',
      licenseType: '3', // MIT
    });

    const options = {
      hostname: 'api.bscscan.com',
      path: '/api',
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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse BSCScan response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function checkVerificationStatus(guid, apiKey) {
  return new Promise((resolve, reject) => {
    const params = querystring.stringify({
      apikey: apiKey,
      module: 'contract',
      action: 'checkverifystatus',
      guid,
    });

    const options = {
      hostname: 'api.bscscan.com',
      path: '/api?' + params,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse BSCScan status response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function deploy() {
  const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
  const privateKey = process.env.DEPLOY_PRIVATE_KEY;
  const bscscanApiKey = process.env.BSCSCAN_API_KEY;

  if (!privateKey) {
    console.error('ERROR: DEPLOY_PRIVATE_KEY is missing in backend/.env');
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

  console.log('\nDeploying TokenGateway contract to BNB Smart Chain...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployedContract = await factory.deploy();

  console.log('Deployment TX sent:', deployedContract.deploymentTransaction().hash);
  console.log('Waiting for block confirmations...');
  await deployedContract.waitForDeployment();

  const gatewayAddress = await deployedContract.getAddress();
  console.log('\n======================================================');
  console.log('SUCCESS! TokenGateway deployed to BSC:');
  console.log('Contract Address:', gatewayAddress);
  console.log('BscScan URL:     https://bscscan.com/address/' + gatewayAddress);
  console.log('======================================================\n');

  // Save artifacts
  const artifactDir = path.join(__dirname, '../contracts/artifacts');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(artifactDir, 'TokenGateway.json'),
    JSON.stringify({ abi, bytecode, address: gatewayAddress }, null, 2)
  );
  console.log('Artifacts saved to contracts/artifacts/TokenGateway.json');

  // BSCScan Verification
  if (!bscscanApiKey) {
    console.log('\n[SKIP] BSCSCAN_API_KEY not set — skipping automatic verification.');
    console.log('You can verify manually at: https://bscscan.com/verifyContract');
    return;
  }

  console.log('\nWaiting 15 seconds for BSCScan to index the contract...');
  await new Promise((r) => setTimeout(r, 15000));

  // Detect compiler version from solc
  const solcVersion = solc.version(); // e.g. "0.8.20+commit.xxxxxxxx...."
  const compilerVersion = 'v' + solcVersion.replace('.Emscripten.clang', '');

  console.log('Submitting source for verification (compiler: ' + compilerVersion + ')...');
  const verifyResult = await verifyOnBscscan(gatewayAddress, sourceCode, compilerVersion, bscscanApiKey);
  console.log('BSCScan verification response:', verifyResult);

  if (verifyResult.status !== '1') {
    console.error('Verification submission failed:', verifyResult.result);
    return;
  }

  const guid = verifyResult.result;
  console.log('Verification GUID:', guid);
  console.log('Polling verification status...');

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const statusResult = await checkVerificationStatus(guid, bscscanApiKey);
    console.log('[' + (i + 1) + '/12] Status:', statusResult.result);
    if (statusResult.result === 'Pass - Verified') {
      console.log('\n✅ Contract VERIFIED on BSCScan!');
      console.log('View at: https://bscscan.com/address/' + gatewayAddress + '#code');
      break;
    }
    if (statusResult.result && statusResult.result.startsWith('Fail')) {
      console.error('\n❌ Verification FAILED:', statusResult.result);
      break;
    }
  }
}

deploy().catch((err) => {
  console.error('Deployment error:', err);
  process.exit(1);
});
