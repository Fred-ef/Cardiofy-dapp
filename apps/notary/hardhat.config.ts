import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      chainId: 11155111,
      url: process.env['NOTARY_RPC_URL'] ?? '',
      accounts: process.env['NOTARY_PRIVATE_KEY'] ? [process.env['NOTARY_PRIVATE_KEY']] : [],
    },
    gnosis: {
      chainId: 100,
      url: process.env['NOTARY_RPC_URL'] ?? '',
      accounts: process.env['NOTARY_PRIVATE_KEY'] ? [process.env['NOTARY_PRIVATE_KEY']] : [],
    },
  },
  etherscan: {
    apiKey: process.env['ETHERSCAN_API_KEY'] ?? '',
  },
};

export default config;
