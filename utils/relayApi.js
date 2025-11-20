import axios from "axios"

const relayApi = axios.create({
  // baseURL: process.env.RELAY_API_KEY.includes("testnet")
  //   ? "https://api-testnet.relay.link"
  //   : "https://api.relay.link",
  baseURL: "https://api.relay.link",
  headers: {
    Authorization: `Bearer ${process.env.RELAY_API_KEY}`,
    "Content-Type": "application/json",
    "x-relay-source": "my-dapp",
  },
})

export default relayApi
