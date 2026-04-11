const REQUEST_STATUS_LABELS = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  en_proceso: "En proceso",
  completada: "Completada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
};

const REQUEST_STATUS_TONES = {
  pendiente: "warning",
  en_revision: "info",
  aprobada: "positive",
  en_proceso: "info",
  completada: "positive",
  rechazada: "critical",
  cancelada: "default",
};

const normalizeStatus = (value) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

const formatDateLabel = (value) => {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const requestStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  return REQUEST_STATUS_LABELS[normalized] || "En seguimiento";
};

const requestStatusTone = (status) => {
  const normalized = normalizeStatus(status);
  return REQUEST_STATUS_TONES[normalized] || "default";
};

const mapRequestToBrowserItem = (request = {}) => {
  const status = normalizeStatus(request.status);
  return {
    id: request.id,
    title: request.position_title || "Solicitud sin nombre",
    subtitle: request.request_number,
    detail: request.department_name,
    status,
    statusLabel: requestStatusLabel(status),
    tone: requestStatusTone(status),
    workflow: request.workflow,
    updatedAt: request.updated_at || request.created_at,
  };
};

const mapApplicantToBrowserItem = (applicant = {}) => ({
  id: applicant.id,
  title: applicant.fullname || applicant.name || "Postulante sin nombre",
  subtitle: applicant.email,
  detail: applicant.cargo || applicant.position_title || applicant.area,
  status: applicant.status,
  updatedAt: applicant.updated_at,
});

const mapCollaboratorToBrowserItem = (collaborator = {}) => {
  const statusValue =
    collaborator.estatus_empleado ||
    (collaborator.active === false ? "inactivo" : "activo");
  const normalizedStatus = normalizeStatus(statusValue);
  const isPassive = normalizedStatus === "pasivo" || normalizedStatus === "desvinculado";
  return {
    id: collaborator.id,
    title:
      collaborator.fullname ||
      collaborator.email ||
      collaborator.employee_number ||
      "Colaborador",
    subtitle: collaborator.email,
    detail: collaborator.department_name || collaborator.department,
    status: statusValue,
    statusLabel: isPassive ? "Pasivo" : String(statusValue || "Activo"),
    updatedAt: collaborator.updated_at || collaborator.last_login,
  };
};

const mapRequestToHeaderEntity = (request = {}, options = {}) => {
  const status = normalizeStatus(request.status);
  const selectedApplicantName = options.selectedApplicantName;
  const collaboratorLabel =
    options.assignedCollaborator ||
    request.collaborator_fullname ||
    request.collaborator_user_email ||
    request.collaborator_user_id;

  return {
    title: request.position_title || "Solicitud de personal",
    subtitle: request.department_name,
    detail: request.request_number,
    description:
      selectedApplicantName || request.workflow?.current_stage_label || undefined,
    meta: {
      status: requestStatusLabel(status),
      collaborator: collaboratorLabel,
    },
  };
};

const mapCollaboratorToHeaderEntity = (collaborator = {}) => ({
  title:
    collaborator.fullname ||
    collaborator.email ||
    collaborator.employee_number ||
    "Colaborador",
  subtitle: collaborator.email,
  detail: collaborator.department_name || collaborator.department || undefined,
  description:
    collaborator.position_title || collaborator.job_title || collaborator.role,
});

const mapApplicantToHeaderEntity = (applicant = {}) => ({
  title: applicant.fullname || applicant.name || "Postulante",
  subtitle: applicant.email,
  detail: applicant.cargo || applicant.position_title || undefined,
  description: applicant.location || applicant.residencia,
});

const buildRequestSummaryItems = (request = {}, options = {}) => {
  const status = normalizeStatus(request.status);
  const applicantName =
    options.selectedApplicantName ||
    request.applicant_fullname ||
    request.applicant_name;
  const assignedCollaborator =
    options.assignedCollaborator ||
    request.collaborator_fullname ||
    request.collaborator_name ||
    request.collaborator_user_email;

  const items = [
    {
      key: "status",
      label: "Estado",
      value: requestStatusLabel(status),
      tone: requestStatusTone(status),
    },
    {
      key: "department",
      label: "Departamento",
      value: request.department_name || "Sin departamento",
      tone: "info",
    },
    {
      key: "workflow",
      label: "Etapa actual",
      value: request.workflow?.current_stage_label || "Pendiente",
      tone: request.workflow?.stalled ? "critical" : "default",
    },
  ];

  if (applicantName) {
    items.push({
      key: "applicant",
      label: "Postulante",
      value: applicantName,
      tone: "positive",
    });
  }

  if (assignedCollaborator) {
    items.push({
      key: "assignedCollaborator",
      label: "Responsable operativo",
      value: assignedCollaborator,
      tone: "positive",
    });
  }

  if (request.updated_at) {
    items.push({
      key: "updatedAt",
      label: "Última actualización",
      value: formatDateLabel(request.updated_at),
      tone: "info",
    });
  }

  return items;
};

const buildCollaboratorSummaryItems = (collaborator = {}) => {
  const normalizedStatus = String(collaborator.estatus_empleado || "").toLowerCase();
  const activeStatus =
    normalizedStatus !== "desvinculado" &&
    normalizedStatus !== "pasivo" &&
    collaborator.active !== false;
  return [
    {
      key: "status",
      label: "Estado",
      value: activeStatus ? "Activo" : "Inactivo",
      tone: activeStatus ? "positive" : "warning",
    },
    {
      key: "department",
      label: "Área",
      value: collaborator.department_name || collaborator.department || "Sin área",
      tone: "info",
    },
    {
      key: "email",
      label: "Correo",
      value: collaborator.email || "Sin correo",
      tone: "info",
    },
    {
      key: "updatedAt",
      label: "Última actualización",
      value: formatDateLabel(collaborator.updated_at),
      tone: "info",
    },
  ];
};

const buildApplicantSummaryItems = (applicant = {}) => [
  {
    key: "status",
    label: "Estado",
    value: applicant.status || "En revisión",
    tone: "info",
  },
  {
    key: "position",
    label: "Cargo",
    value: applicant.cargo || applicant.position_title || "Sin cargo",
    tone: "info",
  },
  {
    key: "email",
    label: "Correo",
    value: applicant.email || "Sin correo",
    tone: "info",
  },
  {
    key: "updatedAt",
    label: "Actualizado",
    value: formatDateLabel(applicant.updated_at),
    tone: "info",
  },
];

export {
  REQUEST_STATUS_LABELS,
  mapRequestToBrowserItem,
  mapApplicantToBrowserItem,
  mapCollaboratorToBrowserItem,
  mapRequestToHeaderEntity,
  mapCollaboratorToHeaderEntity,
  mapApplicantToHeaderEntity,
  buildRequestSummaryItems,
  buildCollaboratorSummaryItems,
  buildApplicantSummaryItems,
};
