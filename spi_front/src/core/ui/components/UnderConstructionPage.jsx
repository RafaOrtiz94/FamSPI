import React from 'react';

export default function UnderConstructionPage({ stage = 'construction' }) {
  const isTesting = stage === 'testing';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6 select-none">🚧</div>

        <h1 className="text-2xl font-black text-slate-900 mb-2">
          {isTesting ? 'Módulo en pruebas' : 'Módulo en construcción'}
        </h1>

        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {isTesting
            ? 'Este módulo está siendo probado por un grupo selecto de colaboradores antes de su lanzamiento oficial. Pronto estará disponible para todos.'
            : 'Estamos trabajando en este módulo. Estará disponible próximamente para toda la organización.'}
        </p>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${
          isTesting
            ? 'bg-amber-100 text-amber-700 border border-amber-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isTesting ? 'bg-amber-500' : 'bg-slate-400'}`} />
          {isTesting ? 'Fase de pruebas E2E' : 'En desarrollo'}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Si necesitas acceso anticipado, contacta al área de TI.
        </p>
      </div>
    </div>
  );
}
