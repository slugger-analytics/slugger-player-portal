declare module "https-proxy-agent" {
  // Minimal type shim to keep TS build stable under current moduleResolution.
  // The runtime package ships its own .d.ts, but TS can't resolve it with "moduleResolution": "Node".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const HttpsProxyAgent: any
}

