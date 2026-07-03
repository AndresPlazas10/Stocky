import React from 'react';
import { StockyStatusToast } from '../../../ui/StockyStatusToast';

type ToastsReturn = {
  showMesaCreatedToast: boolean;
  setShowMesaCreatedToast: (v: boolean) => void;
  mesaCreatedLabel: string;
  showMesaDeletedToast: boolean;
  setShowMesaDeletedToast: (v: boolean) => void;
  mesaDeletedLabel: string;
  showSaleToast: boolean;
  setShowSaleToast: (v: boolean) => void;
  saleMesaLabel: string;
  saleTotalLabel: string;
  showMesaSavedToast: boolean;
  setShowMesaSavedToast: (v: boolean) => void;
  mesaSavedLabel: string;
};

type Props = {
  toasts: ToastsReturn;
};

export function MesasToasts({ toasts }: Props) {
  return (
    <>
      <StockyStatusToast
        visible={toasts.showMesaCreatedToast}
        title="Mesa Creada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaCreatedLabel}
        secondaryLabel="Estado"
        secondaryValue="Disponible"
        durationMs={1000}
        onClose={() => toasts.setShowMesaCreatedToast(false)}
      />
      <StockyStatusToast
        visible={toasts.showMesaDeletedToast}
        title="Mesa Eliminada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaDeletedLabel}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1000}
        onClose={() => toasts.setShowMesaDeletedToast(false)}
      />
      <StockyStatusToast
        visible={toasts.showSaleToast}
        title="Venta Confirmada"
        primaryLabel="Mesa"
        primaryValue={toasts.saleMesaLabel}
        secondaryLabel="Total"
        secondaryValue={toasts.saleTotalLabel}
        durationMs={1000}
        onClose={() => toasts.setShowSaleToast(false)}
      />
      <StockyStatusToast
        visible={toasts.showMesaSavedToast}
        title="Mesa Actualizada"
        primaryLabel="Mesa"
        primaryValue={toasts.mesaSavedLabel}
        secondaryLabel="Estado"
        secondaryValue="Actualizada"
        durationMs={1000}
        onClose={() => toasts.setShowMesaSavedToast(false)}
      />
    </>
  );
}
