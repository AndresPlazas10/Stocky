import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import type { MesaHeaderProps } from '@/types/components';

export function MesasHeader({ canManageTables, onToggleAddForm }: MesaHeaderProps) {
  return (
    <Card className="border-accent-200 shadow-lg">
      <CardHeader className="border-b border-accent-100 bg-gradient-to-r from-primary-50 to-accent-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-primary-900 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Gestion de Mesas
          </CardTitle>
          {canManageTables && (
            <Button
              onClick={onToggleAddForm}
              className="gradient-primary text-white hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-11"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
              Agregar Mesa
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
