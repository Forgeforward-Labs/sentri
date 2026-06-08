import axios from "axios";
import { env } from "../config/env.js";

type CacheRecord = {
  value: number | null;
  expiresAt: number;
};

const cache: CacheRecord = {
  value: null,
  expiresAt: 0,
};

export async function getUsdcPriceUsd() {
  const now = Date.now();

  if (cache.expiresAt > now) {
    return cache.value;
  }

  try {
    const response = await axios.get(`${env.coingeckoBaseUrl}/simple/price`, {
      params: {
        ids: "usd-coin",
        vs_currencies: "usd",
      },
      timeout: 10_000,
    });

    console.log("response: ", response.data);

    cache.value = response.data["usd-coin"]?.usd ?? null;
    cache.expiresAt = now + 30_000;

    return cache.value;
  } catch {
    cache.value = null;
    cache.expiresAt = now + 10_000;
    return null;
  }
}
