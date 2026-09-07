import { FirebaseError } from 'firebase/app';

export { FirebaseError };

export enum AppErrorCode {
  NO_APP = 'app/no-app',
  INVALID_APP_NAME = 'app/invalid-app-name',
  DUPLICATE_APP = 'app/duplicate-app',
  APP_DELETED = 'app/app-deleted',
  INVALID_APP_OPTIONS = 'app/invalid-app-options',
  INVALID_ARGUMENT = 'app/invalid-argument',
  INVALID_CREDENTIAL = 'app/invalid-credential',
  INTERNAL_ERROR = 'app/internal-error',
  NETWORK_ERROR = 'app/network-error',
  NETWORK_TIMEOUT = 'app/network-timeout',
  UNABLE_TO_PARSE_RESPONSE = 'app/unable-to-parse-response',
}

export class FirebaseAppError extends FirebaseError {
  constructor(code: string | AppErrorCode, message: string, customData?: Record<string, unknown>) {
    super(code, message, customData);
    Object.defineProperty(this, 'name', {
      value: 'FirebaseAppError',
      configurable: true,
      writable: true,
      enumerable: true
    });
  }
}

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules: ${JSON.stringify(context, null, 2)}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
