
import { AdapterType } from "./provider-api-key.types.js";
import type { ProviderName } from "../Provider/provider-config.types.js";

export interface IProviderApiKey {
  provider: ProviderName;
  apiKey: string | null;
  baseUrl?: string | null;
  label: string;
  adapterType: AdapterType;
  note: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
