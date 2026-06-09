import type { AppEnv } from '../env'



export type RetailConfig = {

  targetMarginPercent: number

  requestTimeoutMs: number

}



export function retailConfigFromEnv(env: AppEnv): RetailConfig {

  const targetMarginPercent = env.RETAIL_TARGET_MARGIN_PERCENT



  return {

    targetMarginPercent,

    requestTimeoutMs: 15_000,

  }

}


