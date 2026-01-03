/**
 * Assumption Service
 * 
 * API service for managing assumption overrides and presets
 */

import { API_ENDPOINTS } from '../config/api';
import type {
  AssumptionOverrides,
  AssumptionPreset,
  AssumptionsResponse
} from '../types/assumptions';

/**
 * Save assumption overrides
 */
export async function saveOverrides(
  overrides: AssumptionOverrides,
  dealId?: string,
  sessionId?: string
): Promise<any> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_OVERRIDES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dealId,
      sessionId,
      ...overrides,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to save overrides: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get assumption overrides
 */
export async function getOverrides(
  id?: string,
  dealId?: string,
  sessionId?: string
): Promise<any> {
  let url = API_ENDPOINTS.ASSUMPTIONS_OVERRIDES;
  if (id) {
    url = API_ENDPOINTS.ASSUMPTIONS_OVERRIDE(id);
  } else {
    const params = new URLSearchParams();
    if (dealId) params.append('dealId', dealId);
    if (sessionId) params.append('sessionId', sessionId);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to get overrides: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Save assumption preset
 */
export async function savePreset(preset: Omit<AssumptionPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_PRESETS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preset),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to save preset: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all assumption presets
 */
export async function getPresets(): Promise<{ success: boolean; data: AssumptionPreset[] }> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_PRESETS, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to get presets: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Apply a preset to current deal
 */
export async function applyPreset(
  presetId: string,
  dealId?: string,
  sessionId?: string
): Promise<any> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_PRESET_APPLY(presetId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dealId,
      sessionId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to apply preset: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get assumptions used in a calculation
 */
export async function getAssumptions(dealId: string): Promise<{ success: boolean; data: AssumptionsResponse }> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_VISIBILITY(dealId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to get assumptions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete an assumption preset
 */
export async function deletePreset(presetId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_PRESET_DELETE(presetId), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete preset: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Suggest HS code based on product category and name
 */
export interface HsCodeSuggestion {
  hsCode: string;
  source: 'product_name' | 'category' | 'default';
  confidence: 'high' | 'medium' | 'low';
  chapter: string | null;
  chapterDescription: string | null;
  formattedCode: string;
}

export async function suggestHsCode(
  category?: string,
  productName?: string
): Promise<{ success: boolean; data: HsCodeSuggestion }> {
  const response = await fetch(API_ENDPOINTS.ASSUMPTIONS_SUGGEST_HS_CODE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category,
      productName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to suggest HS code: ${response.statusText}`);
  }

  return response.json();
}
