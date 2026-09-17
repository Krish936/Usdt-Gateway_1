const { ethers } = require('ethers');
const dotenv = require('dotenv');

dotenv.config();

// Initialize provider for BSC network
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);

// USDT ABI (minimal for our needs)
const USDT_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)"
];

// Initialize USDT contract
const usdtContract = new ethers.Contract(
    process.env.USDT_CONTRACT_ADDRESS,
    USDT_ABI,
    provider
);

class BlockchainService {
    // Verify USDT transaction
    async verifyTransaction(txHash) {
        try {
            console.log(`🔍 Verifying transaction: ${txHash}`);
            
            // Get transaction receipt
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
                return {
                    success: false,
                    message: 'Transaction not found or still pending'
                };
            }
            
            // Check if transaction was successful
            if (receipt.status !== 1) {
                return {
                    success: false,
                    message: 'Transaction failed on blockchain'
                };
            }
            
            // Parse logs to find Transfer events
            const transferEvents = [];
            
            for (const log of receipt.logs) {
                try {
                    // Try to parse the log as USDT Transfer event
                    const parsedLog = usdtContract.interface.parseLog(log);
                    
                    if (parsedLog && parsedLog.name === 'Transfer') {
                        transferEvents.push({
                            from: parsedLog.args.from,
                            to: parsedLog.args.to,
                            value: parsedLog.args.value
                        });
                    }
                } catch (error) {
                    // Log is not a USDT Transfer event, skip it
                    continue;
                }
            }
            
            console.log(`📊 Found ${transferEvents.length} Transfer events`);
            
            // Find transfer to our wallet
            const ourWallet = process.env.YOUR_WALLET_ADDRESS.toLowerCase();
            const transferEvent = transferEvents.find(event => 
                event.to.toLowerCase() === ourWallet
            );
            
            if (!transferEvent) {
                return {
                    success: false,
                    message: 'No transfer to our wallet found in this transaction'
                };
            }
            
            // Convert amount from wei (USDT has 18 decimals)
            const amount = ethers.utils.formatUnits(transferEvent.value, 18);
            
            console.log(`✅ Verified: ${amount} USDT from ${transferEvent.from}`);
            
            return {
                success: true,
                data: {
                    from: transferEvent.from,
                    to: transferEvent.to,
                    amount: parseFloat(amount),
                    blockNumber: receipt.blockNumber
                }
            };
            
        } catch (error) {
            console.error('❌ Verification error:', error.message);
            return {
                success: false,
                message: 'Error verifying transaction: ' + error.message
            };
        }
    }
    
    // Validate wallet address
    isValidAddress(address) {
        try {
            if (!address || typeof address !== 'string') {
                return false;
            }
            return ethers.utils.isAddress(address);
        } catch (error) {
            console.error('Address validation error:', error.message);
            return false;
        }
    }
    
    // Get receiving address
    getReceivingAddress() {
        return process.env.YOUR_WALLET_ADDRESS;
    }
    
    // Get wallet USDT balance
    async getWalletBalance() {
        try {
            const balance = await usdtContract.balanceOf(process.env.YOUR_WALLET_ADDRESS);
            const decimals = await usdtContract.decimals();
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            
            console.log(`💰 Wallet balance: ${formattedBalance} USDT`);
            return parseFloat(formattedBalance);
        } catch (error) {
            console.error('Balance check error:', error.message);
            return 0;
        }
    }
    
    // Get USDT symbol for verification
    async getUSDTSymbol() {
        try {
            const symbol = await usdtContract.symbol();
            return symbol;
        } catch (error) {
            return 'USDT';
        }
    }
}

module.exports = new BlockchainService();