import { useState, useEffect } from 'react';
import { supabase } from '../supabase/Client.jsx';

export function useNotifications(businessId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    loadNotifications();

    // Suscribirse a cambios en tiempo real
    const salesChannel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    const purchasesChannel = supabase
      .channel('purchases-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'purchases',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      salesChannel.unsubscribe();
      purchasesChannel.unsubscribe();
      productsChannel.unsubscribe();
    };
  }, [businessId]);

  const loadNotifications = async () => {
    try {
      const allNotifications = [];

      // 1. Stock bajo - Productos con stock menor a 10
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .lt('stock', 10)
        .order('stock', { ascending: true })
        .limit(5);

      if (lowStockProducts) {
        lowStockProducts.forEach(product => {
          allNotifications.push({
            id: `stock-${product.id}`,
            type: 'stock',
            title: '⚠️ Stock bajo',
            message: `${product.name} tiene solo ${product.stock} unidades`,
            time: 'Ahora',
            unread: true,
            priority: 'high'
          });
        });
      }

      // 2. Ventas recientes - Últimas 3 ventas de hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: recentSales } = await supabase
        .from('sales')
        .select('id, total, created_at')
        .eq('business_id', businessId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentSales) {
        recentSales.forEach(sale => {
          const timeAgo = getTimeAgo(new Date(sale.created_at));
          allNotifications.push({
            id: `sale-${sale.id}`,
            type: 'sale',
            title: '💰 Nueva venta',
            message: `Venta completada por $${sale.total.toLocaleString('es-CO')}`,
            time: timeAgo,
            unread: true,
            priority: 'medium'
          });
        });
      }

      // 3. Compras recientes - Últimas 3 compras de hoy
      const { data: recentPurchases } = await supabase
        .from('purchases')
        .select(`
          id, 
          total, 
          created_at,
          supplier:suppliers(business_name, contact_name)
        `)
        .eq('business_id', businessId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentPurchases) {
        recentPurchases.forEach(purchase => {
          const timeAgo = getTimeAgo(new Date(purchase.created_at));
          const supplierName = purchase.supplier?.business_name || purchase.supplier?.contact_name || 'Proveedor';
          allNotifications.push({
            id: `purchase-${purchase.id}`,
            type: 'purchase',
            title: '📦 Nueva compra',
            message: `Compra a ${supplierName} por $${purchase.total.toLocaleString('es-CO')}`,
            time: timeAgo,
            unread: true,
            priority: 'medium'
          });
        });
      }

      // Ordenar por prioridad y tiempo
      allNotifications.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMinutes < 1) return 'Justo ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, unread: false } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, unread: false }))
    );
  };

  return {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications
  };
}
