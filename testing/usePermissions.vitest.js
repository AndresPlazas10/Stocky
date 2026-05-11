import { describe, it, expect } from 'vitest';
import { usePermissions } from '../src/hooks/optimized.js';

describe('usePermissions', () => {
  it('returns owner permissions', () => {
    const permissions = usePermissions('owner');
    expect(permissions.canEditBusiness).toBe(true);
    expect(permissions.canMakeSales).toBe(true);
    expect(permissions.canManageInventory).toBe(true);
    expect(permissions.canManageEmployees).toBe(true);
    expect(permissions.canDeleteSales).toBe(true);
    expect(permissions.canViewReports).toBe(true);
  });

  it('returns admin permissions', () => {
    const permissions = usePermissions('admin');
    expect(permissions.canMakeSales).toBe(true);
    expect(permissions.canManageInventory).toBe(true);
    expect(permissions.canEditBusiness).toBe(false);
  });

  it('returns cashier permissions (limited, sales only)', () => {
    const permissions = usePermissions('cashier');
    expect(permissions.canMakeSales).toBe(true);
    expect(permissions.canManageInventory).toBe(false);
    expect(permissions.canManageEmployees).toBe(false);
    expect(permissions.canDeleteSales).toBe(false);
  });

  it('returns warehouse permissions', () => {
    const permissions = usePermissions('warehouse');
    expect(permissions.canManageInventory).toBe(true);
    expect(permissions.canMakePurchases).toBe(true);
    expect(permissions.canMakeSales).toBe(false);
  });

  it('defaults to cashier for unknown roles', () => {
    const permissions = usePermissions('unknown_role');
    expect(permissions.canMakeSales).toBe(true);
  });

  it('defaults to cashier for null/undefined', () => {
    expect(usePermissions(null).canMakeSales).toBe(true);
    expect(usePermissions(undefined).canMakeSales).toBe(true);
  });
});
