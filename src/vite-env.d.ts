/// <reference types="vite/client" />

import type { WavedashSDK } from "@wvdsh/sdk-js";

declare global {
  interface Window {
    Wavedash?: WavedashSDK;
  }
}
