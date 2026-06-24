/* eslint-env node */
import { z } from 'zod';
import { sendError } from './apiUtils.js';

/**
 * Validates a request body against a zod schema
 * @param {import('zod').ZodSchema} schema - The zod schema to validate against
 * @param {import('http').IncomingMessage} req - The request object
 * @param {import('http').ServerResponse} res - The response object
 * @returns {{ success: boolean, data?: any, error?: string }} Validation result
 */
export function validateBody(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError ? `${firstError.path.join('.')}: ${firstError.message}` : 'Invalid request body';
    sendError(res, 400, message);
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}

/**
 * Validates query parameters against a zod schema
 * @param {import('zod').ZodSchema} schema - The zod schema to validate against
 * @param {import('http').IncomingMessage} req - The request object
 * @param {import('http').ServerResponse} res - The response object
 * @returns {{ success: boolean, data?: any, error?: string }} Validation result
 */
export function validateQuery(schema, req, res) {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError ? `${firstError.path.join('.')}: ${firstError.message}` : 'Invalid query parameters';
    sendError(res, 400, message);
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}

// --- Common Schemas ---

/** Schema for business_id required in body */
export const BusinessIdSchema = z.object({
  business_id: z.string().min(1, 'business_id is required'),
});

/** Schema for open/close table */
export const OpenCloseTableSchema = z.object({
  table_id: z.string().min(1, 'table_id is required'),
  action: z.enum(['open', 'close'], { errorMap: () => ({ message: 'action must be open or close' }) }),
});

/** Schema for notify sale registered */
export const NotifySaleSchema = z.object({
  business_id: z.string().min(1, 'business_id is required'),
  sale_total: z.number().min(0, 'sale_total must be non-negative'),
});

/** Schema for notify employee login */
export const NotifyEmployeeLoginSchema = z.object({
  business_id: z.string().min(1, 'business_id is required'),
  employee_name: z.string().optional(),
});

/** Schema for notify low stock */
export const NotifyLowStockSchema = z.object({
  business_id: z.string().min(1, 'business_id is required'),
  product_ids: z.array(z.string()).optional(),
});

/** Schema for PWA push subscription */
export const PwaPushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url('Invalid endpoint URL'),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1, 'p256dh key is required'),
      auth: z.string().min(1, 'auth key is required'),
    }),
  }),
});

/** Schema for send email */
export const SendEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  invoiceNumber: z.string().min(1, 'invoiceNumber is required'),
  customerName: z.string().min(1, 'customerName is required'),
  total: z.number().min(0, 'total must be non-negative'),
  items: z.array(z.object({
    product_name: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().min(0),
    unit_price: z.number().min(0),
  })),
  businessName: z.string().optional(),
  businessId: z.string().min(1, 'businessId is required'),
  issuedAt: z.string().datetime().optional(),
});
