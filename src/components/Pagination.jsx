/**
 * 📄 Componente de Paginación Reutilizable
 * Muestra controles de paginación con información de registros
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from "./ui/button";

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  disabled = false
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleFirstPage = () => {
    if (!disabled && canGoPrevious) {
      onPageChange(1);
    }
  };

  const handlePreviousPage = () => {
    if (!disabled && canGoPrevious) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (!disabled && canGoNext) {
      onPageChange(currentPage + 1);
    }
  };

  const handleLastPage = () => {
    if (!disabled && canGoNext) {
      onPageChange(totalPages);
    }
  };

  // No mostrar paginación si no hay datos
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-white">
      {/* Información de registros */}
      {showInfo && (
        <div className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{startItem}</span> a{' '}
          <span className="font-medium">{endItem}</span> de{' '}
          <span className="font-medium">{totalItems}</span> registros
        </div>
      )}

      {/* Controles de navegación */}
      <div className="flex items-center gap-2">
        {/* Primera página */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleFirstPage}
          disabled={disabled || !canGoPrevious}
          className="hidden sm:flex"
          title="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Página anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousPage}
          disabled={disabled || !canGoPrevious}
          title="Página anterior"
        >
          <ChevronLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Indicador de página actual */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        {/* Página siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={disabled || !canGoNext}
          title="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4 sm:ml-2" />
        </Button>

        {/* Última página */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLastPage}
          disabled={disabled || !canGoNext}
          className="hidden sm:flex"
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Selector de items por página (opcional para futuro) */}
      {/* 
      <select 
        className="text-sm border border-gray-300 rounded-md px-2 py-1"
        value={itemsPerPage}
        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
      >
        <option value={25}>25 por página</option>
        <option value={50}>50 por página</option>
        <option value={100}>100 por página</option>
      </select>
      */}
    </div>
  );
}
