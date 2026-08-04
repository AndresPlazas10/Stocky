import { supabase } from '../../../supabase/Client';

export const employeesAdapter = {
  async insertEmployee(row) {
    return supabase
      .from('employees')
      .insert([row])
      .select()
      .maybeSingle();
  },

  async getEmployeeByUserAndBusiness(userId, businessId, selectSql = 'id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle();
  },

  async getEmployeesByBusiness(businessId) {
    return supabase
      .from('employees')
      .select('user_id, full_name, role')
      .eq('business_id', businessId);
  },

  async getEmployeesByBusinessWithSelect(businessId, selectSql) {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
  },

  async getEmployeeByBusinessAndUsername({ businessId, username, selectSql = 'id' }) {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('business_id', businessId)
      .eq('username', username)
      .maybeSingle();
  },

  async getEmployeeRoleByBusinessAndUser(businessId, userId) {
    return supabase
      .from('employees')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();
  },

  async createEmployeeRpc(payload) {
    return supabase.rpc('create_employee', payload);
  },

  async deleteEmployeeRpc(employeeId) {
    return supabase.rpc('delete_employee', {
      p_employee_id: employeeId
    });
  },

  async deleteEmployeeByBusinessAndId({ employeeId, businessId }) {
    return supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('business_id', businessId);
  },

  async getActiveEmployeeByUserId(userId, selectSql = 'id, business_id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
  },

  async getEmployeeByUserId(userId, selectSql = 'id, business_id') {
    return supabase
      .from('employees')
      .select(selectSql)
      .eq('user_id', userId)
      .maybeSingle();
  },
};
