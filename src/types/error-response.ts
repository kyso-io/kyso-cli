export interface ErrorResponse {
  error: string;
  extendedMessage?: string[];
  message: string;
  method?: string;
  path?: string;
  statusCode: number;
  timestamp: string;
}
