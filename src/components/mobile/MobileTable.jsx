import { MobileListCard } from './MobileCard';

/**
 * Tabla optimizada para móvil
 * En móvil: Renderiza como lista de cards
 * En desktop: Renderiza como tabla normal
 * 
 * Uso:
 * <MobileTable
 *   data={products}
 *   columns={[
 *     { key: 'name', label: 'Nombre', primary: true },
 *     { key: 'price', label: 'Precio', format: (val) => `$${val}` },
 *     { key: 'stock', label: 'Stock' }
 *   ]}
 *   onRowClick={(item) => }
 * />
 */
export function MobileTable({ 
  data = [], 
  columns = [], 
  onRowClick,
  emptyMessage = "No hay datos disponibles",
  loading = false,
  renderMobileCard, // Función personalizada para renderizar cards
  actions // Columna de acciones
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  // Encuentra la columna primaria (título)
  const primaryCol = columns.find(col => col.primary) || columns[0];
  const secondaryCol = columns.find(col => col.secondary) || columns[1];
  const metaCols = columns.filter(col => !col.primary && !col.secondary && col.key !== 'actions');

  return (
    <>
      {/* Vista móvil: Cards */}
      <div className="sm:hidden space-y-3">
        {data.map((item, index) => {
          // Si hay función personalizada, úsala
          if (renderMobileCard) {
            return renderMobileCard(item, index);
          }

          // Renderizado por defecto
          const primaryValue = primaryCol.format 
            ? primaryCol.format(item[primaryCol.key], item)
            : item[primaryCol.key];
          
          const secondaryValue = secondaryCol
            ? (secondaryCol.format 
                ? secondaryCol.format(item[secondaryCol.key], item)
                : item[secondaryCol.key])
            : null;

          const metaValue = metaCols
            .map(col => {
              const val = col.format 
                ? col.format(item[col.key], item)
                : item[col.key];
              return `${col.label}: ${val}`;
            })
            .join(' • ');

          return (
            <MobileListCard
              key={item.id || index}
              title={primaryValue}
              subtitle={secondaryValue}
              meta={metaValue}
              onClick={onRowClick ? () => onRowClick(item) : null}
              actions={actions ? actions(item) : null}
            />
          );
        })}
      </div>

      {/* Vista desktop: Tabla normal */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr 
                key={item.id || index}
                onClick={onRowClick ? () => onRowClick(item) : null}
                className={onRowClick ? 'hover:bg-gray-50 cursor-pointer transition-colors' : ''}
              >
                {columns.map((col) => {
                  const value = col.format 
                    ? col.format(item[col.key], item)
                    : item[col.key];
                  
                  return (
                    <td 
                      key={col.key}
                      className="px-4 py-3 text-sm text-gray-900"
                    >
                      {value}
                    </td>
                  );
                })}
                {actions && (
                  <td className="px-4 py-3 text-right">
                    {actions(item)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
