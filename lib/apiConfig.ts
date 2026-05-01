import { getApiUrl } from '@/lib/query-client';

export const API_BASE_URL = `${getApiUrl().replace(/\/$/, '')}/api/v1`;
