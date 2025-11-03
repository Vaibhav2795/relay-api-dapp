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
    const quote = await getQuote({
      user: "0x94b4214c2F27d23208c7B66dF60AA23F802a1d25",
      originChainId: 11155111,
      destinationChainId: 84532,
      originCurrency: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
      destinationCurrency: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      recipient: "0x94b4214c2F27d23208c7B66dF60AA23F802a1d25",
      amount: "1700000",
    })

    console.log("Quote received:", quote)
  } catch (error) {
    console.error("Failed to get quote:", error.message)
  }
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
// runExample()
runTransferExample()

// interacting with: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
// transfering to: 0x3e34b27a9bf37D8424e1a58aC7fc4D06914B76B9
