import { useCallback, useState } from 'react';

export function useMesaToasts() {
  const [showMesaCreatedToast, setShowMesaCreatedToast] = useState(false);
  const [mesaCreatedLabel, setMesaCreatedLabel] = useState('Mesa');
  const [showMesaDeletedToast, setShowMesaDeletedToast] = useState(false);
  const [mesaDeletedLabel, setMesaDeletedLabel] = useState('Mesa');
  const [showSaleToast, setShowSaleToast] = useState(false);
  const [saleMesaLabel, setSaleMesaLabel] = useState('Mesa');
  const [saleTotalLabel, setSaleTotalLabel] = useState('');
  const [showMesaSavedToast, setShowMesaSavedToast] = useState(false);
  const [mesaSavedLabel, setMesaSavedLabel] = useState('Mesa');

  const showCreatedToast = useCallback((label: string) => {
    setMesaCreatedLabel(label);
    setShowMesaCreatedToast(true);
  }, []);

  const showDeletedToast = useCallback((label: string) => {
    setMesaDeletedLabel(label);
    setShowMesaDeletedToast(true);
  }, []);

  const showSaleConfirmationToast = useCallback((mesaName: string, total: string) => {
    setSaleMesaLabel(mesaName);
    setSaleTotalLabel(total);
    setShowSaleToast(true);
  }, []);

  const showSavedToast = useCallback((label: string) => {
    setMesaSavedLabel(label);
    setShowMesaSavedToast(true);
  }, []);

  return {
    showMesaCreatedToast,
    setShowMesaCreatedToast,
    mesaCreatedLabel,
    showMesaDeletedToast,
    setShowMesaDeletedToast,
    mesaDeletedLabel,
    showSaleToast,
    setShowSaleToast,
    saleMesaLabel,
    saleTotalLabel,
    showMesaSavedToast,
    setShowMesaSavedToast,
    mesaSavedLabel,
    showCreatedToast,
    showDeletedToast,
    showSaleConfirmationToast,
    showSavedToast,
  };
}
