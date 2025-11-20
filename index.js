import relayApi from "./utils/relayApi.js"
import {
  createWalletClient,
  http,
  parseEther,
  formatEther,
  createPublicClient,
} from "viem"
import { sepolia, baseSepolia } from "viem/chains"
import dotenv from "dotenv"
import { Wallet, ethers, Contract } from "ethers"

dotenv.config()

async function testRelayApi() {
  try {
    const response = await relayApi.get("/chains")
    console.log("Relay Protocol Chains:", response.data)
  } catch (error) {
    console.error("Relay API Error:", error.response?.data || error.message)
  }
}

async function getQuote({
  user,
  originChainId,
  destinationChainId,
  originCurrency,
  destinationCurrency,
  recipient,
  tradeType = "EXACT_INPUT",
  amount,
  referrer = "relay.link",
  useExternalLiquidity = false,
  useDepositAddress = false,
  topupGas = false,
}) {
  try {
    const quoteData = {
      user,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      recipient,
      tradeType,
      amount,
      referrer,
      useExternalLiquidity,
      useDepositAddress,
      topupGas,
    }

    const response = await relayApi.post("/quote", quoteData)

    return response.data
  } catch (error) {
    console.error("Quote API Error:", error.response?.data || error.message)
    throw error
  }
}

export async function getUserBalance({
  walletAddress,
  rpcUrl,
  tokenAddress = null, // null = native token (ETH)
}) {
  if (!walletAddress) {
    throw new Error("walletAddress is required")
  }
  if (!rpcUrl) {
    throw new Error("rpcUrl is required")
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)

  // 🔹 If no tokenAddress → return native balance (ETH)
  if (!tokenAddress) {
    const balance = await provider.getBalance(walletAddress)
    return {
      symbol: "ETH",
      decimals: 18,
      raw: balance,
      formatted: ethers.formatEther(balance),
    }
  }

  // 🔹 If tokenAddress exists → return ERC20 balance
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ]

  const token = new ethers.Contract(tokenAddress, erc20Abi, provider)

  const [rawBalance, decimals, symbol] = await Promise.all([
    token.balanceOf(walletAddress),
    token.decimals(),
    token.symbol(),
  ])

  return {
    symbol,
    decimals,
    raw: rawBalance,
    formatted: ethers.formatUnits(rawBalance, decimals),
  }
}

async function transferFunds({
  to,
  amount,
  chainId = 11155111, // Default to Sepolia
  currency = "ETH", // Default to ETH
  tokenAddress = null, // ERC20 token contract address
}) {
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY not found in environment variables")
    }

    // Use ethers.js for better RPC compatibility
    const rpcUrl =
      chainId === 11155111
        ? "https://eth-sepolia.g.alchemy.com/v2/sVUSe_hStYmanofM2Ke1gb6JkQuu2PZc" // Replace with your Infura key
        : "https://base-sepolia.g.alchemy.com/v2/sVUSe_hStYmanofM2Ke1gb6JkQuu2PZc" // Replace with your Alchemy key

    const wallet = new Wallet(process.env.PRIVATE_KEY)

    // Connect wallet to provider
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const connectedWallet = wallet.connect(provider)

    console.log(`Transferring ${amount} ${tokenAddress} to ${to}`)
    console.log(`From address: ${connectedWallet.address}`)

    const erc20Abi = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ]

    const tokenContract = new ethers.Contract(
      tokenAddress,
      erc20Abi,
      connectedWallet
    )

    const [rawBalance, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(connectedWallet.address),
      tokenContract.decimals(),
      tokenContract.symbol(),
    ])

    console.log(
      `Balance: ${ethers.formatUnits(rawBalance, decimals)} ${symbol}`
    )
    const amountWei = ethers.parseUnits(amount, decimals)
    console.log(`Amount to send: ${ethers.formatEther(amountWei)} ETH`)

    const tx = await tokenContract.transfer(to, amountWei)
    console.log(`⏳ Sending ${amount} ${symbol} to ${to}...`)
    console.log("Tx hash:", tx.hash)

    // Wait for confirmation
    await tx.wait()
    console.log(`✅ Sent ${amount} ${symbol} successfully!`)

    const hash = tx.hash

    console.log(`Transaction sent! Hash: ${hash}`)

    // Show explorer link based on chain
    const explorerUrl =
      chainId === 11155111
        ? `https://sepolia.etherscan.io/tx/${hash}`
        : `https://sepolia.basescan.org/tx/${hash}`
    console.log(`View on explorer: ${explorerUrl}`)

    return hash
  } catch (error) {
    console.error("Transfer Error:", error.message)
    throw error
  }
}

async function indexTransaction({ txHash, chainId, referrer = "relay.link" }) {
  try {
    const indexData = {
      txHash,
      chainId: chainId.toString(),
      referrer,
    }

    const response = await relayApi.post("/transactions/index", indexData)
    console.log("Transaction indexed:", response.data)
    return response.data
  } catch (error) {
    console.error(
      "Index Transaction Error:",
      error.response?.data || error.message
    )
    throw error
  }
}

// Example usage
async function runExample() {
  try {
    // ----- CONFIG -----
    // BASE - USDC
    const ORIGIN = {
      currency: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      chainId: 8453,
    }

    // OP Mainnet - USDC
    const DESTINATION = {
      currency: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      chainId: 10,
    }

    const USER_WALLET_ADDRESS = "0x97153e31abfd0ea7c782b0c8a97026ea07e98e00"
    const RECIPIENT = USER_WALLET_ADDRESS

    const AMOUNT = "1344800"

    // ----- GET BALANCE -----
    const balance = await getUserBalance({
      walletAddress: USER_WALLET_ADDRESS,
      rpcUrl: process.env.BASE_MAINNET_RPC,
      tokenAddress: ORIGIN.currency,
    })

    console.log(
      "Balance at target chain:",
      balance.formatted + " " + balance.symbol
    )

    // ----- GET QUOTE -----
    const quote = await getQuote({
      user: USER_WALLET_ADDRESS,
      originChainId: ORIGIN.chainId,
      originCurrency: ORIGIN.currency,
      destinationChainId: DESTINATION.chainId,
      destinationCurrency: DESTINATION.currency,
      recipient: RECIPIENT,
      amount: AMOUNT,
      useDepositAddress: true,
      refundTo: RECIPIENT,
    })

    console.log("Quote:", quote)
    console.log("Deposit address:", quote.steps[0].depositAddress)
    console.log("Request ID:", quote.steps[0].requestId)
    // console.log("Data:", quote.steps[0].items)

    // ----- GET STATUS -----
    const status = await getStatus({ requestId: quote.steps[0].requestId })
    console.log("Status:", status)
  } catch (error) {
    console.error("Failed to get quote:", error.message)
  }
}

const getStatus = async ({ requestId }) => {
  const response = await relayApi.get(`/intents/status?requestId=${requestId}`)
  return response.data
}

// Example transfer function
async function runTransferExample() {
  try {
    const txHash = await transferFunds({
      to: "0x3e34b27a9bf37D8424e1a58aC7fc4D06914B76B9", // Recipient address
      amount: "1", // Amount in USDC
      chainId: 11155111, // Sepolia testnet
      currency: "USDC",
      tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC contract address
    })

    console.log("Transfer completed:", txHash)

    // Index the transaction with Relay Protocol
    const indexResult = await indexTransaction({
      txHash: txHash,
      chainId: 11155111,
      referrer: "relay.link",
    })

    console.log("Transaction indexed successfully:", indexResult)
  } catch (error) {
    console.error("Transfer or indexing failed:", error.message)
  }
}

// Run the examples
// testRelayApi()
runExample()
// runTransferExample()

// interacting with: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
// transfering to: 0x3e34b27a9bf37D8424e1a58aC7fc4D06914B76B9
