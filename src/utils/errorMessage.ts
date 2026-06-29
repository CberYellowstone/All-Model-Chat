export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));
