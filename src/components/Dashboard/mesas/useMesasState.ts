import { useState, useEffect, useCallback } from 'react';
import { useLowMotionMode } from '../../../hooks/useLowMotionMode.js';
import { useProgressiveList } from '../../../hooks/useProgressiveList.js';
import { useDebounce } from '../../../hooks/optimized.js';
import {
  getAuthenticatedUser as getAuthenticatedUserFromOrders,
  getEmployeeRoleInBusiness as getEmployeeRoleInBusinessForOrders,
  isEmployeeInBusiness as isEmployeeInBusinessForOrders,
} from '../../../data/queries/authQueries';
import { isAdminRole } from '../../../utils/roles.js';
import type { MesaRecord, AlertDetail } from '../../../types/components';
import type { ProductWithSupplier } from '../../../types/product';

interface ComboItem {
  id: string;
  nombre?: string;
  name?: string;
}

export function useMesasState(businessId: string, userRole: string = 'admin') {
  const canManageTables = isAdminRole(userRole);
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [successDetails, setSuccessDetails] = useState<AlertDetail[]>([]);
  const [successTitle, setSuccessTitle] = useState<string>('Accion Completada');
  const [alertType, setAlertType] = useState<string>('success');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [selectedMesa, setSelectedMesa] = useState<MesaRecord | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);
  const [modalOpenIntent, setModalOpenIntent] = useState<boolean>(false);
  const [isEmployee, setIsEmployee] = useState<boolean>(false);

  const [orderItems, setOrderItems] = useState<unknown[]>([]);
  const [, setPendingQuantityUpdates] = useState<Record<string, unknown>>({});
  const [products, setProducts] = useState<ProductWithSupplier[]>([]);
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [searchProduct, setSearchProduct] = useState<string>('');
  const debouncedSearch = useDebounce(searchProduct, 200);

  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);

  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showCloseOrderChoiceModal, setShowCloseOrderChoiceModal] = useState<boolean>(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState<boolean>(false);
  const [isGeneratingSplitSales, setIsGeneratingSplitSales] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [amountReceivedError, setAmountReceivedError] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [isClosingOrder, setIsClosingOrder] = useState<boolean>(false);
  const [isCreatingTable, setIsCreatingTable] = useState<boolean>(false);
  const [pendingOrderItemOps, setPendingOrderItemOps] = useState<number>(0);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [mesaToDelete, setMesaToDelete] = useState<MesaRecord | null>(null);

  const [canShowOrderModal, setCanShowOrderModal] = useState<boolean>(true);
  const isOrderItemsSyncing = pendingOrderItemOps > 0;

  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [_printSaleIds, setPrintSaleIds] = useState<string[]>([]);
  const [printSaleDataList, setPrintSaleDataList] = useState<unknown[]>([]);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState<boolean>(false);
  const [printCustomerName, setPrintCustomerName] = useState<string>('Venta general');

  const lowMotionMode = useLowMotionMode();

  const {
    visibleItems: visibleMesas,
    hasMore: hasMoreMesas,
    totalCount: totalMesas,
    sentinelRef: mesasSentinelRef,
    loadMore: loadMoreMesas,
  } = useProgressiveList(mesas, {
    initialCount: lowMotionMode ? 12 : 20,
    step: lowMotionMode ? 12 : 20,
    resetKey: `${mesas.length}:${lowMotionMode ? 'low' : 'full'}`,
  });

  const getCurrentUser = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders() as Record<string, unknown> | null;
      if (user) {
        const metadata = user.user_metadata as Record<string, unknown> | undefined;
        const normalizedUser = {
          id: user.id as string,
          email: (user.email as string) || '',
          name: ((metadata?.full_name as string) || (metadata?.name as string) || ''),
          role: 'admin',
        };
        setCurrentUser(normalizedUser);
        return normalizedUser;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const checkIfEmployee = useCallback(async () => {
    try {
      const user = await getAuthenticatedUserFromOrders();
      if (!user) {
        setIsEmployee(false);
        return;
      }
      const employeeInBusiness = await isEmployeeInBusinessForOrders({ userId: user.id, businessId });
      if (!employeeInBusiness) {
        setIsEmployee(false);
        return;
      }
      const role = await getEmployeeRoleInBusinessForOrders({ userId: user.id, businessId });
      const hasAdminPrivileges = isAdminRole(role);
      setIsEmployee(!hasAdminPrivileges);
    } catch {
      setIsEmployee(false);
    }
  }, [businessId]);

  const loadCustomers = useCallback(async () => {
    setCustomers([]);
  }, []);

  useEffect(() => {
    if (!canManageTables && showAddForm) {
      setShowAddForm(false);
    }
  }, [canManageTables, showAddForm]);

  useEffect(() => {
    let errorTimer: ReturnType<typeof setTimeout>;
    let successTimer: ReturnType<typeof setTimeout>;
    if (error) errorTimer = setTimeout(() => setError(null), 5000);
    if (success) successTimer = setTimeout(() => setSuccess(false), 5000);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      if (successTimer) clearTimeout(successTimer);
    };
  }, [error, success]);

  return {
    canManageTables,
    mesas,
    setMesas,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    successDetails,
    setSuccessDetails,
    successTitle,
    setSuccessTitle,
    alertType,
    setAlertType,
    showAddForm,
    setShowAddForm,
    selectedMesa,
    setSelectedMesa,
    showOrderDetails,
    setShowOrderDetails,
    modalOpenIntent,
    setModalOpenIntent,
    isEmployee,
    orderItems,
    setOrderItems,
    setPendingQuantityUpdates,
    products,
    setProducts,
    combos,
    setCombos,
    searchProduct,
    setSearchProduct,
    debouncedSearch,
    currentUser,
    setCurrentUser,
    quantityToAdd,
    setQuantityToAdd,
    showPaymentModal,
    setShowPaymentModal,
    showCloseOrderChoiceModal,
    setShowCloseOrderChoiceModal,
    showSplitBillModal,
    setShowSplitBillModal,
    isGeneratingSplitSales,
    setIsGeneratingSplitSales,
    paymentMethod,
    setPaymentMethod,
    amountReceived,
    setAmountReceived,
    amountReceivedError,
    setAmountReceivedError,
    selectedCustomer,
    setSelectedCustomer,
    customers,
    setCustomers,
    isClosingOrder,
    setIsClosingOrder,
    isCreatingTable,
    setIsCreatingTable,
    pendingOrderItemOps,
    setPendingOrderItemOps,
    newTableNumber,
    setNewTableNumber,
    showDeleteModal,
    setShowDeleteModal,
    mesaToDelete,
    setMesaToDelete,
    canShowOrderModal,
    setCanShowOrderModal,
    isOrderItemsSyncing,
    showPrintModal,
    setShowPrintModal,
    _printSaleIds,
    setPrintSaleIds,
    printSaleDataList,
    setPrintSaleDataList,
    isPrintingReceipt,
    setIsPrintingReceipt,
    printCustomerName,
    setPrintCustomerName,
    lowMotionMode,
    visibleMesas,
    hasMoreMesas,
    totalMesas,
    mesasSentinelRef,
    loadMoreMesas,
    getCurrentUser,
    checkIfEmployee,
    loadCustomers,
  };
}
