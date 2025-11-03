import relayApi from "./utils/relayApi.js"
import { Wallet, ethers, Contract } from "ethers"
import dotenv from "dotenv"
import { erc20Abi } from "viem"

dotenv.config()

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

async function waitForSuccess(endpoint, interval = 2000, timeout = 60000) {
  return new Promise(async (resolve, reject) => {
    const start = Date.now()

    const check = async () => {
      try {
        const intent = await relayApi.get(endpoint)
        console.log("Checking status:", intent.data.status)

        if (intent.data.status === "success") {
          clearInterval(timer)
          resolve(intent.data)
        } else if (Date.now() - start > timeout) {
          clearInterval(timer)
          reject(new Error("Timeout waiting for success"))
        }
      } catch (err) {
        clearInterval(timer)
        reject(err)
      }
    }

    // Immediately check once
    await check()

    // Then check every interval
    const timer = setInterval(check, interval)
  })
}

async function main() {
  // ----- CONFIG -----
  const originCurrency = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
  const destinationCurrency = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
  const recipient = "0x94b4214c2F27d23208c7B66dF60AA23F802a1d25"
  const amount = "0.2"

  // ----- SETUP -----
  const provider = new ethers.JsonRpcProvider(process.env.ETH_SEPOLIA_RPC)
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider)

  // Connect token contract to wallet (signer)
  const tokenContract = new ethers.Contract(originCurrency, erc20Abi, wallet)

  const [rawBalance, decimals, symbol] = await Promise.all([
    tokenContract.balanceOf(wallet.address),
    tokenContract.decimals(),
    tokenContract.symbol(),
  ])

  const formattedBalance = ethers.formatUnits(rawBalance, decimals)

  if (formattedBalance < amount) {
    console.log("Insufficient balance")
    // throw new Error("Insufficient balance")
  }

  const amountInWei = ethers.parseUnits(amount, decimals)

  try {
    const quote = await getQuote({
      user: wallet.address,
      originChainId: 11155111,
      destinationChainId: 84532,
      originCurrency: originCurrency,
      destinationCurrency: destinationCurrency,
      recipient: recipient,
      amount: amountInWei.toString(),
    })

    console.log(`🚀 ~ quote:`, quote)
    const item = quote.steps[0].items[0]
    console.log(`🚀 ~ item:`, item)
    //   ======================================================
    //  Example of item data:
    //  {
    //   status: 'incomplete',
    //   data: {
    //     from: '0x94b4214c2F27d23208c7B66dF60AA23F802a1d25',
    //     to: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    //     data: '0xa9059cbb0000000000000000000000003e34b27a9bf37d8424e1a58ac7fc4d06914b76b9000000000000000000000000000000000000000000000000000000000019f0a01edf2158f0075fbaf75f64b8db9b7f56d1dcac1ac1eed7ccd8a44587b8e4596f',
    //     value: '0',
    //     chainId: 11155111,
    //     gas: '59745',
    //     maxFeePerGas: '135695787',
    //     maxPriorityFeePerGas: '135695776'
    //   },
    //   check: {
    //     endpoint: '/intents/status?requestId=0x1edf2158f0075fbaf75f64b8db9b7f56d1dcac1ac1eed7ccd8a44587b8e4596f',
    //     method: 'GET'
    //   }
    // }
    // ======================================================

    // Depositing funds to the relayer to execute the swap for USDC
    // console.log(`transferring funds to the relayer address ${item.data.to}`)
    // const tx = await tokenContract.transfer(
    //   "0x3e34b27a9bf37d8424e1a58ac7fc4d06914b76b9",
    //   amountInWei
    // )
    // console.log(`🚀 ~ tx:`, tx)

    // await tx.wait()
    // console.log(`Transaction confirmed`)
    // console.log(item.check.endpoint)

    // // Get intent status
    // const data = await waitForSuccess(item.check.endpoint)
    // console.log(`🚀 ~ data:`, data)
  } catch (error) {
    console.error("Error getting quote:", error.message)
  }
}

main()
