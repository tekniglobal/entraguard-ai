// Subset of the Microsoft Graph SignIn schema. Mirrors:
// https://learn.microsoft.com/en-us/graph/api/resources/signin
//
// Kept intentionally lean — only fields we use for reasoning, plus enough
// nesting to look credible when shown as "raw Graph response."

export type MfaDetail =
  | "mfaCompleted"
  | "mfaFailed"
  | "mfaNotRequired"
  | "mfaSkipped"
  | null;

export type ConditionalAccessStatus =
  | "success"
  | "failure"
  | "notApplied"
  | "unknownFutureValue";

export type RiskLevel = "none" | "low" | "medium" | "high" | "hidden";

export type RiskState =
  | "none"
  | "atRisk"
  | "confirmedSafe"
  | "confirmedCompromised"
  | "dismissed"
  | "remediated";

export interface GraphLocation {
  city?: string;
  state?: string;
  countryOrRegion?: string;
  geoCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface GraphDeviceDetail {
  deviceId?: string;
  displayName?: string;
  operatingSystem?: string;
  browser?: string;
  isCompliant?: boolean;
  isManaged?: boolean;
  trustType?: string;
}

export interface GraphStatus {
  errorCode: number;
  failureReason?: string;
  additionalDetails?: string;
}

export interface GraphSignIn {
  id: string;
  createdDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  userId: string;
  appDisplayName?: string;
  appId?: string;
  resourceDisplayName?: string;
  resourceId?: string;
  ipAddress?: string;
  clientAppUsed?: string;
  isInteractive: boolean;
  conditionalAccessStatus?: ConditionalAccessStatus;
  riskDetail?: string;
  riskLevelAggregated?: RiskLevel;
  riskLevelDuringSignIn?: RiskLevel;
  riskState?: RiskState;
  status?: GraphStatus;
  deviceDetail?: GraphDeviceDetail;
  location?: GraphLocation;
  mfaDetail?: { authMethod?: string; authDetail?: string };
  authenticationRequirement?:
    | "singleFactorAuthentication"
    | "multiFactorAuthentication";
}
