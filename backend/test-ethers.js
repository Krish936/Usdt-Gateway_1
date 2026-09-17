const { ethers } = require('ethers');

async function testConnection() {
    try {
        console.log('🔄 Testing BSC connection...');
        
        const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
        
        const blockNumber = await provider.getBlockNumber();
        console.log('✅ Connected to BSC!');
        console.log('📦 Current block:', blockNumber);
        
        // Test USDT contract
        const usdtAddress = '0x55d398326f99059fF775485246999027B3197955';
        const usdtABI = ["function symbol() view returns (string)"];
        const usdtContract = new ethers.Contract(usdtAddress, usdtABI, provider);
        
        const symbol = await usdtContract.symbol();
        console.log('💎 USDT Symbol:', symbol);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();