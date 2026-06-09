import { StockyStatusToast } from '../../../ui/StockyStatusToast';

interface MesasToastsProps {
  showCreated: boolean;
  createdLabel: string;
  showDeleted: boolean;
  deletedLabel: string;
  showSale: boolean;
  saleMesaLabel: string;
  saleTotalLabel: string;
  showSaved: boolean;
  savedLabel: string;
  onCloseCreated: () => void;
  onCloseDeleted: () => void;
  onCloseSale: () => void;
  onCloseSaved: () => void;
}

export function MesasToasts({
  showCreated,
  createdLabel,
  showDeleted,
  deletedLabel,
  showSale,
  saleMesaLabel,
  saleTotalLabel,
  showSaved,
  savedLabel,
  onCloseCreated,
  onCloseDeleted,
  onCloseSale,
  onCloseSaved,
}: MesasToastsProps) {
  return (
    <>
      <StockyStatusToast
        visible={showCreated}
        title="Mesa Creada"
        primaryLabel="Mesa"
        primaryValue={createdLabel}
        secondaryLabel="Estado"
        secondaryValue="Disponible"
        durationMs={1000}
        onClose={onCloseCreated}
      />
      <StockyStatusToast
        visible={showDeleted}
        title="Mesa Eliminada"
        primaryLabel="Mesa"
        primaryValue={deletedLabel}
        secondaryLabel="Estado"
        secondaryValue="Eliminada"
        durationMs={1000}
        onClose={onCloseDeleted}
      />
      <StockyStatusToast
        visible={showSale}
        title="Venta Confirmada"
        primaryLabel="Mesa"
        primaryValue={saleMesaLabel}
        secondaryLabel="Total"
        secondaryValue={saleTotalLabel}
        durationMs={1000}
        onClose={onCloseSale}
      />
      <StockyStatusToast
        visible={showSaved}
        title="Mesa Actualizada"
        primaryLabel="Mesa"
        primaryValue={savedLabel}
        secondaryLabel="Estado"
        secondaryValue="Actualizada"
        durationMs={1000}
        onClose={onCloseSaved}
      />
    </>
  );
}
