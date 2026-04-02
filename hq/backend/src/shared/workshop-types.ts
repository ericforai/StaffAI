export interface WorkshopRegistration {
  url: string;
  capabilities: string[];
  registered_at?: string;
}

export interface WorkshopRegistrationResponse {
  status: 'success' | 'error';
  workshop?: WorkshopRegistration;
  error?: string;
}
