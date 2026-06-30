import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./ui/button";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  disabled?: boolean;
};

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  disabled = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-white">
      {showInfo && (
        <div className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{startItem}</span> a{" "}
          <span className="font-medium">{endItem}</span> de{" "}
          <span className="font-medium">{totalItems}</span> registros
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => !disabled && canGoPrevious && onPageChange(1)}
          disabled={disabled || !canGoPrevious}
          className="hidden sm:flex"
          title="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => !disabled && canGoPrevious && onPageChange(currentPage - 1)}
          disabled={disabled || !canGoPrevious}
          title="Página anterior"
        >
          <ChevronLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => !disabled && canGoNext && onPageChange(currentPage + 1)}
          disabled={disabled || !canGoNext}
          title="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4 sm:ml-2" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => !disabled && canGoNext && onPageChange(totalPages)}
          disabled={disabled || !canGoNext}
          className="hidden sm:flex"
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
