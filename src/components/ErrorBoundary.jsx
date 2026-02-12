import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Aquí puedes reportar a un servicio de errores si lo deseas
    // console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center p-6 bg-gray-50 overflow-hidden">
          <div className="max-w-xl text-center max-h-[calc(100vh-120px)] overflow-auto">
            <h1 className="text-2xl font-bold mb-2">Ha ocurrido un error inesperado</h1>
            <p className="text-sm text-gray-600 mb-4">Nuestro equipo ya fue notificado. Intenta recargar la página.</p>
            <pre className="text-xs text-left bg-white p-3 rounded border overflow-x-auto text-red-600">{String(this.state.error)}</pre>
            <div className="mt-4">
              <button onClick={() => location.reload()} className="px-4 py-2 bg-green-600 text-white rounded">Recargar</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
