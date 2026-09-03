import React from 'react';
import { FiBookOpen, FiCheckCircle, FiClock } from 'react-icons/fi';
import TabBadge from '../../components/TabBadge';

const TRAINING_FORMATS = [
  { code: 'F.ST-04', name: 'Plan de entrenamiento', key: 'training_plan' },
  { code: 'F.ST-05', name: 'Registro de asistencia', key: 'training_attendance' },
];

const hasValue = (value) => {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const TrainingTab = ({ purchase }) => {
  const training = purchase?.training_workflow || purchase?.training || {};

  const getFormatStatus = (format) => (
    hasValue(training?.[format.key]) || hasValue(purchase?.[format.key]) ? 'completado' : 'pendiente'
  );

  const completedCount = TRAINING_FORMATS.filter((format) => getFormatStatus(format) === 'completado').length;

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-ink-slate">Entrenamiento</h2>
          <p className="text-xs text-warm-ash mt-0.5">Planificacion, asistencia y conformidad</p>
        </div>
        <TabBadge status={completedCount === TRAINING_FORMATS.length ? 'completado' : 'pendiente'} />
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiClock className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Estado del entrenamiento</h3>
          </div>
          <div className="text-xs text-warm-ash">
            El entrenamiento se habilita despues de instalacion y verificacion tecnica.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-soft-border p-5 shadow-ambient">
          <div className="flex items-center gap-2 mb-4">
            <FiBookOpen className="text-action-blue" size={18} />
            <h3 className="text-sm font-semibold text-ink-slate">Formatos de entrenamiento</h3>
            <span className="ml-auto text-xs text-warm-ash">{completedCount}/{TRAINING_FORMATS.length}</span>
          </div>
          <div className="space-y-3">
            {TRAINING_FORMATS.map((format) => {
              const status = getFormatStatus(format);
              return (
                <div key={format.code} className="flex items-center justify-between p-4 bg-paper-white rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-action-blue">{format.code}</span>
                      <span className="text-sm font-medium text-ink-slate">{format.name}</span>
                    </div>
                  </div>
                  {status === 'completado' ? (
                    <div className="flex items-center gap-1 text-xs text-operative-green"><FiCheckCircle size={14} />Completado</div>
                  ) : (
                    <span className="text-xs text-warm-ash">Pendiente</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingTab;
